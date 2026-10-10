/**
 * Inventory, holds and orders. Server-authoritative:
 *  - inventory units are locked by creating documents with deterministic IDs (atomic by uniqueness);
 *  - expired locks are reclaimed with delete-then-create (compare-and-retry);
 *  - orders are idempotent per (user, idempotencyKey);
 *  - totals are computed from authoritative offer prices, never from the client.
 */
import { DomainError } from '../../../lib/competition/states.ts';
import { computeOrderTotals, deriveMatchTicketStatus, evaluateOfferWindow, validateQuantity } from '../../../lib/ticketing/pricing.ts';
import { assertHoldTransition, assertOrderTransition, isOrderPayable } from '../../../lib/ticketing/states.ts';
import type { Currency } from '../../../lib/ticketing/types.ts';
import {
  COL,
  detId,
  int,
  loadSettings,
  mustGet,
  publicDoc,
  randomId,
  requireUser,
  str,
  userReadPermission,
  type AppContext,
  type RequestContext,
} from './context.ts';
import { ConflictError, NotFoundError, type Doc } from './db.ts';

type Body = Record<string, unknown>;

export function lockId(offerId: string, unitKey: string): string {
  return detId('lk', offerId, unitKey);
}

function isLockLive(lock: Doc, now: Date): boolean {
  if (lock.state === 'sold') return true;
  if (lock.state !== 'held') return false;
  return Date.parse(String(lock.expires_at)) > now.getTime();
}

/* ------------------------------- availability ------------------------------- */

export async function offerAvailability(ctx: AppContext, offer: Doc, now: Date) {
  const locks = await ctx.db.list(COL.locks, { where: [['offer_id', 'eq', offer.$id]] });
  const taken = new Set<string>();
  for (const l of locks) if (isLockLive(l, now)) taken.add(String(l.unit_key));
  const capacity = Number(offer.capacity);
  return { taken, available: Math.max(0, capacity - taken.size), locks };
}

export async function matchAvailability(ctx: AppContext, req: RequestContext, matchId: string) {
  const now = ctx.now();
  const match = mustGet(await ctx.db.get(COL.matches, matchId), 'Match');
  if (match.published === false) throw new NotFoundError('Match not found');
  const offers = await ctx.db.list(COL.offers, { where: [['match_id', 'eq', matchId]] });
  const out: Array<Record<string, unknown> & { id: string; mine: string[] | null }> = [];
  const counts: number[] = [];
  for (const o of offers) {
    const { taken, available } = await offerAvailability(ctx, o, now);
    counts.push(available);
    const window = evaluateOfferWindow(o as never, now);
    const section = await ctx.db.get(COL.sections, String(o.section_id));
    out.push({
      ...publicDoc(o),
      id: o.$id,
      sellable: window.sellable,
      window_reason: window.reason ?? null,
      available,
      // assigned seating: unit keys that are not selectable (no owner information is exposed)
      unavailable_units: o.kind === 'assigned' ? [...taken] : undefined,
      section: section ? publicDoc(section) : null,
      mine: null as null | string[],
    });
  }
  // units held by the requesting user (so the UI can show "yours")
  if (req.userId) {
    const myHolds = await ctx.db.list(COL.holds, { where: [['user_id', 'eq', req.userId], ['match_id', 'eq', matchId], ['state', 'eq', 'active']] });
    for (const h of myHolds) {
      const o = out.find((x) => x.id === h.offer_id);
      if (o) o.mine = (h.unit_keys as string[]) ?? [];
    }
  }
  const status = deriveMatchTicketStatus(match.status as never, offers as never, counts, now);
  return { match_id: matchId, status, offers: out, server_time: now.toISOString() };
}

/* ---------------------------------- holds ---------------------------------- */

async function releaseHold(ctx: AppContext, hold: Doc, to: 'released' | 'expired') {
  if (hold.state !== 'active') return;
  const locks = await ctx.db.list(COL.locks, { where: [['hold_id', 'eq', hold.$id]] });
  for (const l of locks) {
    if (l.state === 'held') {
      try {
        await ctx.db.delete(COL.locks, l.$id);
      } catch {
        /* already gone */
      }
    }
  }
  assertHoldTransition(hold.state as never, to);
  await ctx.db.update(COL.holds, hold.$id, { state: to });
}

async function tryLock(ctx: AppContext, offer: Doc, unitKey: string, holdId: string, userId: string, expiresAt: string, now: Date): Promise<boolean> {
  const id = lockId(offer.$id, unitKey);
  const data = { offer_id: offer.$id, match_id: String(offer.match_id), unit_key: unitKey, hold_id: holdId, user_id: userId, state: 'held', expires_at: expiresAt };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await ctx.db.create(COL.locks, id, data);
      return true;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e;
      const existing = await ctx.db.get(COL.locks, id);
      if (!existing) continue; // deleted in between: retry create
      if (isLockLive(existing, now)) return false;
      // expired lock: reclaim (delete + retry create). Another process may win the race; that is fine.
      try {
        await ctx.db.delete(COL.locks, id);
      } catch {
        /* someone else deleted it */
      }
    }
  }
  return false;
}

export async function createHold(ctx: AppContext, req: RequestContext, body: Body) {
  const userId = requireUser(req);
  const settings = await loadSettings(ctx.db);
  if (!settings.competition_enabled) throw new DomainError('feature_disabled', 'Ticketing is currently unavailable', 503);
  const now = ctx.now();
  const matchId = str(body.matchId, 'matchId')!;
  const offerId = str(body.offerId, 'offerId')!;
  const match = mustGet(await ctx.db.get(COL.matches, matchId), 'Match');
  if (match.published === false) throw new NotFoundError('Match not found');
  if (match.status !== 'scheduled') throw new DomainError('sales_closed', 'Tickets are not available for this match', 409);
  const offer = mustGet(await ctx.db.get(COL.offers, offerId), 'Ticket offer');
  if (offer.match_id !== matchId) throw new DomainError('invalid_input', 'Offer does not belong to this match');
  const window = evaluateOfferWindow(offer as never, now);
  if (!window.sellable) {
    const map: Record<string, [string, string]> = {
      before_window: ['not_on_sale', 'Tickets are not on sale yet'],
      after_window: ['sales_closed', 'Ticket sales have closed'],
      closed: ['sales_closed', 'Ticket sales have closed'],
      sold_out: ['sold_out', 'This section is sold out'],
      paused: ['sales_paused', 'Ticket sales are paused'],
      draft: ['not_on_sale', 'Tickets are not on sale yet'],
    };
    const [code, msg] = map[window.reason ?? 'draft'];
    throw new DomainError(code, msg, 409);
  }

  let unitKeys: string[];
  if (offer.kind === 'assigned') {
    const raw = body.unitKeys;
    if (!Array.isArray(raw) || !raw.length || !raw.every((k) => typeof k === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(k))) {
      throw new DomainError('invalid_input', 'Select at least one seat');
    }
    unitKeys = [...new Set(raw as string[])];
    validateQuantity(offer as never, unitKeys.length);
    for (const k of unitKeys) {
      const seat = await ctx.db.get(COL.seats, k);
      if (!seat || seat.section_id !== offer.section_id) throw new DomainError('invalid_input', `Seat ${k} is not in this section`);
    }
  } else {
    const quantity = validateQuantity(offer as never, body.quantity);
    unitKeys = []; // chosen below
    const { taken, available } = await offerAvailability(ctx, offer, now);
    if (available < quantity) throw new DomainError('insufficient_inventory', available === 0 ? 'This section is sold out' : `Only ${available} ticket(s) left`, 409);
    for (let n = 1; n <= Number(offer.capacity) && unitKeys.length < quantity; n++) {
      const key = `ga-${n}`;
      if (!taken.has(key)) unitKeys.push(key);
    }
  }

  // one active hold per user per match: release the previous one first
  const previous = await ctx.db.list(COL.holds, { where: [['user_id', 'eq', userId], ['match_id', 'eq', matchId], ['state', 'eq', 'active']] });
  for (const p of previous) await releaseHold(ctx, p, 'released');

  const holdId = randomId('h');
  const expiresAt = new Date(now.getTime() + settings.hold_ttl_seconds * 1000).toISOString();
  const acquired: string[] = [];
  const lost: string[] = [];
  // GA: compare-and-retry over the candidate space if a unit is contested
  let candidates = [...unitKeys];
  let cursor = 0;
  while (acquired.length < unitKeys.length) {
    const key = candidates[cursor++];
    if (key == null) {
      if (offer.kind === 'ga') {
        // pick fresh candidates beyond those already tried
        const tried = new Set([...candidates]);
        const { taken } = await offerAvailability(ctx, offer, now);
        const extra: string[] = [];
        for (let n = 1; n <= Number(offer.capacity) && extra.length < unitKeys.length - acquired.length; n++) {
          const k = `ga-${n}`;
          if (!taken.has(k) && !tried.has(k)) extra.push(k);
        }
        if (!extra.length) break;
        candidates = [...candidates, ...extra];
        continue;
      }
      break;
    }
    const ok = await tryLock(ctx, offer, key, holdId, userId, expiresAt, now);
    if (ok) acquired.push(key);
    else lost.push(key);
  }
  if (acquired.length < unitKeys.length) {
    for (const k of acquired) {
      try {
        await ctx.db.delete(COL.locks, lockId(offer.$id, k));
      } catch {
        /* ignore */
      }
    }
    if (offer.kind === 'assigned') {
      throw new DomainError('seat_unavailable', `Seat(s) no longer available: ${lost.join(', ')}`, 409);
    }
    throw new DomainError('insufficient_inventory', 'Not enough tickets left in this section', 409);
  }

  const hold = await ctx.db.create(
    COL.holds,
    holdId,
    {
      user_id: userId,
      match_id: matchId,
      offer_id: offerId,
      quantity: acquired.length,
      unit_keys: acquired,
      state: 'active',
      expires_at: expiresAt,
      unit_price_minor: Number(offer.price_minor),
      fee_minor: Number(offer.fee_minor),
      currency: String(offer.currency),
      order_id: null,
      created_at: now.toISOString(),
    },
    userReadPermission(userId),
  );
  return publicDoc(hold);
}

export async function cancelHold(ctx: AppContext, req: RequestContext, holdId: string) {
  const userId = requireUser(req);
  const hold = mustGet(await ctx.db.get(COL.holds, holdId), 'Hold');
  if (hold.user_id !== userId) throw new DomainError('forbidden', 'Not your hold', 403);
  await releaseHold(ctx, hold, 'released');
  return { ok: true };
}

/* ---------------------------------- orders ---------------------------------- */

export async function createOrder(ctx: AppContext, req: RequestContext, body: Body) {
  const userId = requireUser(req);
  const now = ctx.now();
  const holdId = str(body.holdId, 'holdId')!;
  const idempotencyKey = str(body.idempotencyKey, 'idempotencyKey', { max: 128 })!;
  const orderId = detId('or', userId, idempotencyKey);
  const existing = await ctx.db.get(COL.orders, orderId);
  if (existing) {
    if (existing.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
    return { order: publicDoc(existing), repriced: null, idempotent: true };
  }
  const hold = mustGet(await ctx.db.get(COL.holds, holdId), 'Hold');
  if (hold.user_id !== userId) throw new DomainError('forbidden', 'Not your hold', 403);
  if (hold.state !== 'active') throw new DomainError('hold_inactive', 'This hold is no longer active', 409);
  if (Date.parse(String(hold.expires_at)) <= now.getTime()) {
    await releaseHold(ctx, hold, 'expired');
    throw new DomainError('hold_expired', 'Your seats were released because the hold expired', 409);
  }
  const user = await ctx.lookupUser(userId);
  if (!user?.email) throw new DomainError('email_required', 'Sign in with an email account to buy tickets', 403);

  const offer = mustGet(await ctx.db.get(COL.offers, String(hold.offer_id)), 'Ticket offer');
  const match = mustGet(await ctx.db.get(COL.matches, String(hold.match_id)), 'Match');
  if (match.status !== 'scheduled') throw new DomainError('sales_closed', 'Tickets are not available for this match', 409);
  const window = evaluateOfferWindow(offer as never, now);
  if (!window.sellable) throw new DomainError('sales_closed', 'Ticket sales have closed for this section', 409);
  const section = mustGet(await ctx.db.get(COL.sections, String(offer.section_id)), 'Section');

  // authoritative pricing (repricing is surfaced, never silently applied)
  let repriced: { from: number; to: number } | null = null;
  if (Number(offer.price_minor) !== Number(hold.unit_price_minor) || Number(offer.fee_minor) !== Number(hold.fee_minor)) {
    repriced = { from: Number(hold.unit_price_minor) + Number(hold.fee_minor), to: Number(offer.price_minor) + Number(offer.fee_minor) };
    if (body.acceptRepricing !== true) {
      throw new DomainError('repriced', `The price changed to ${repriced.to} ${offer.currency}. Review and confirm.`, 409);
    }
    await ctx.db.update(COL.holds, hold.$id, { unit_price_minor: Number(offer.price_minor), fee_minor: Number(offer.fee_minor) });
  }
  const unitKeys = (hold.unit_keys as string[]) ?? [];
  const totals = computeOrderTotals([
    { unitPriceMinor: Number(offer.price_minor), feeMinor: Number(offer.fee_minor), quantity: unitKeys.length, currency: String(offer.currency) as Currency },
  ]);
  const order = await ctx.db.create(
    COL.orders,
    orderId,
    {
      user_id: userId,
      match_id: String(hold.match_id),
      hold_id: hold.$id,
      state: 'awaiting_checkout',
      subtotal_minor: totals.subtotalMinor,
      fees_minor: totals.feesMinor,
      total_minor: totals.totalMinor,
      currency: totals.currency,
      idempotency_key: idempotencyKey,
      provider: null,
      provider_ref: null,
      purchaser_email: user.email,
      created_at: now.toISOString(),
      paid_at: null,
      expires_at: hold.expires_at,
      note: null,
    },
    userReadPermission(userId),
  );
  for (const key of unitKeys) {
    let seatLabel: string | null = null;
    if (offer.kind === 'assigned') {
      const seat = await ctx.db.get(COL.seats, key);
      seatLabel = seat ? String(seat.label) : key;
    }
    await ctx.db.create(
      COL.orderItems,
      detId('oi', orderId, key),
      {
        order_id: orderId,
        offer_id: offer.$id,
        unit_key: key,
        description: `${offer.name}${seatLabel ? ` - Seat ${seatLabel}` : ''}`,
        section_name: String(section.name),
        seat_label: seatLabel,
        unit_price_minor: Number(offer.price_minor),
        fee_minor: Number(offer.fee_minor),
        currency: String(offer.currency),
      },
      userReadPermission(userId),
    );
  }
  assertHoldTransition(hold.state as never, 'converted');
  await ctx.db.update(COL.holds, hold.$id, { state: 'converted', order_id: orderId });
  const locks = await ctx.db.list(COL.locks, { where: [['hold_id', 'eq', hold.$id]] });
  for (const l of locks) await ctx.db.update(COL.locks, l.$id, { order_id: orderId });
  return { order: publicDoc(order), repriced, idempotent: false };
}

export async function getOrder(ctx: AppContext, req: RequestContext, orderId: string) {
  const userId = requireUser(req);
  const order = mustGet(await ctx.db.get(COL.orders, orderId), 'Order');
  if (order.user_id !== userId && !(await ctx.isAdmin(userId))) throw new DomainError('forbidden', 'Not your order', 403);
  const items = await ctx.db.list(COL.orderItems, { where: [['order_id', 'eq', orderId]] });
  const attempts = await ctx.db.list(COL.attempts, { where: [['order_id', 'eq', orderId]], orderBy: [{ field: 'created_at', dir: 'desc' }] });
  const tickets = await ctx.db.list(COL.tickets, { where: [['order_id', 'eq', orderId]] });
  const deliveries = await ctx.db.list(COL.deliveries, { where: [['order_id', 'eq', orderId]] });
  const hold = await ctx.db.get(COL.holds, String(order.hold_id));
  const settings = await loadSettings(ctx.db);
  return {
    order: publicDoc(order),
    items: items.map((i) => publicDoc(i)),
    attempt: attempts[0] ? publicDoc(attempts[0]) : null,
    tickets: tickets.map((t) => {
      const { nonce: _n, ...rest } = publicDoc(t);
      return rest;
    }),
    deliveries: deliveries.map((d) => publicDoc(d)),
    hold: hold ? publicDoc(hold) : null,
    checkout: {
      enabled: settings.checkout_enabled && ctx.provider.id !== 'none',
      provider: ctx.provider.id,
      test_mode: !ctx.provider.live,
      refunds_enabled: settings.refunds_enabled,
    },
    server_time: ctx.now().toISOString(),
  };
}

export async function listOrders(ctx: AppContext, req: RequestContext) {
  const userId = requireUser(req);
  const docs = await ctx.db.list(COL.orders, { where: [['user_id', 'eq', userId]], orderBy: [{ field: 'created_at', dir: 'desc' }], limit: 100 });
  return docs.map((d) => publicDoc(d));
}

async function ensureOrderWindow(ctx: AppContext, order: Doc) {
  const now = ctx.now();
  if (order.expires_at && Date.parse(String(order.expires_at)) <= now.getTime() && isOrderPayable(order.state as never)) {
    await expireOrder(ctx, order);
    throw new DomainError('order_expired', 'This order expired because the seat hold ran out. Start again.', 409);
  }
}

export async function expireOrder(ctx: AppContext, order: Doc) {
  assertOrderTransition(order.state as never, 'expired');
  await ctx.db.update(COL.orders, order.$id, { state: 'expired' });
  const locks = await ctx.db.list(COL.locks, { where: [['order_id', 'eq', order.$id]] });
  for (const l of locks) if (l.state === 'held') await ctx.db.delete(COL.locks, l.$id);
}

export async function startCheckout(ctx: AppContext, req: RequestContext, orderId: string, body: Body) {
  const userId = requireUser(req);
  const order = mustGet(await ctx.db.get(COL.orders, orderId), 'Order');
  if (order.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
  const settings = await loadSettings(ctx.db);
  if (!settings.checkout_enabled || ctx.provider.id === 'none') {
    throw new DomainError('checkout_unavailable', 'Checkout is not available yet. Your order is saved.', 409);
  }
  if (!isOrderPayable(order.state as never)) {
    if (order.state === 'pending') throw new DomainError('payment_pending', 'A payment is already in progress', 409);
    throw new DomainError('invalid_transition', `Order is ${order.state}`, 409);
  }
  await ensureOrderWindow(ctx, order);
  const now = ctx.now();
  const attemptId = randomId('pa');
  const returnUrl = str(body.returnUrl, 'returnUrl', { optional: true, max: 2048 }) ?? '';
  await ctx.db.create(
    COL.attempts,
    attemptId,
    {
      order_id: orderId,
      provider: ctx.provider.id,
      provider_ref: null,
      state: 'created',
      amount_minor: Number(order.total_minor),
      currency: String(order.currency),
      checkout_url: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      failure_reason: null,
    },
    userReadPermission(userId),
  );
  const session = await ctx.provider.createCheckout({
    orderId,
    attemptId,
    amountMinor: Number(order.total_minor),
    currency: String(order.currency) as Currency,
    description: `LinkUp tickets order ${orderId}`,
    returnUrl,
    cancelUrl: returnUrl,
  });
  await ctx.db.update(COL.attempts, attemptId, { provider_ref: session.providerRef, checkout_url: session.checkoutUrl, state: 'redirected', updated_at: now.toISOString() });
  assertOrderTransition(order.state as never, 'pending');
  // extend the inventory locks for the payment window so a slow provider cannot lose the seats
  const paymentDeadline = new Date(now.getTime() + ctx.paymentWindowSeconds * 1000).toISOString();
  await ctx.db.update(COL.orders, orderId, { state: 'pending', provider: ctx.provider.id, provider_ref: session.providerRef, expires_at: paymentDeadline });
  const locks = await ctx.db.list(COL.locks, { where: [['order_id', 'eq', orderId]] });
  for (const l of locks) if (l.state === 'held') await ctx.db.update(COL.locks, l.$id, { expires_at: paymentDeadline });
  return { attempt_id: attemptId, checkout_url: session.checkoutUrl, provider: ctx.provider.id, test_mode: !ctx.provider.live };
}

export async function cancelOrder(ctx: AppContext, req: RequestContext, orderId: string) {
  const userId = requireUser(req);
  const order = mustGet(await ctx.db.get(COL.orders, orderId), 'Order');
  if (order.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
  const state = order.state as string;
  if (state === 'pending' && order.provider_ref) {
    const r = await ctx.provider.cancel(String(order.provider_ref));
    if (r.state === 'succeeded') throw new DomainError('already_paid', 'Payment already completed. Refresh the order.', 409);
  }
  if (['awaiting_checkout', 'pending', 'failed'].includes(state)) {
    assertOrderTransition(state as never, 'cancelled');
    await ctx.db.update(COL.orders, orderId, { state: 'cancelled' });
    const locks = await ctx.db.list(COL.locks, { where: [['order_id', 'eq', orderId]] });
    for (const l of locks) if (l.state === 'held') await ctx.db.delete(COL.locks, l.$id);
    const attempts = await ctx.db.list(COL.attempts, { where: [['order_id', 'eq', orderId]] });
    for (const a of attempts) {
      if (['created', 'redirected', 'pending'].includes(String(a.state))) {
        await ctx.db.update(COL.attempts, a.$id, { state: 'cancelled', updated_at: ctx.now().toISOString() });
      }
    }
    return { ok: true, state: 'cancelled' };
  }
  if (state === 'paid') {
    assertOrderTransition('paid', 'cancellation_requested');
    await ctx.db.update(COL.orders, orderId, { state: 'cancellation_requested', note: 'Cancellation requested by purchaser. Refund policy pending approval.' });
    return { ok: true, state: 'cancellation_requested', refunds_enabled: (await loadSettings(ctx.db)).refunds_enabled };
  }
  throw new DomainError('invalid_transition', `Order is ${state}`, 409);
}

export async function listMyTickets(ctx: AppContext, req: RequestContext) {
  const userId = requireUser(req);
  const docs = await ctx.db.list(COL.tickets, { where: [['user_id', 'eq', userId]], orderBy: [{ field: 'issued_at', dir: 'desc' }], limit: 200 });
  return docs.map((t) => {
    const { nonce: _n, ...rest } = publicDoc(t);
    return rest;
  });
}

export function assertInt(v: unknown, field: string) {
  return int(v, field);
}

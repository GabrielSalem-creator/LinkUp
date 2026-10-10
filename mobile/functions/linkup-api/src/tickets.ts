/**
 * Ticket issuance (exactly once), opaque signed QR credentials, validation and email delivery queue.
 */
import { DomainError } from '../../../lib/competition/states.ts';
import { credentialMessage, formatCredential, parseCredential } from '../../../lib/ticketing/qr.ts';
import { assertTicketTransition } from '../../../lib/ticketing/states.ts';
import { formatMoney } from '../../../lib/ticketing/money.ts';
import { COL, detId, hmac, mustGet, publicDoc, randomId, requireAdmin, requireUser, safeEqual, userReadPermission, type AppContext, type RequestContext } from './context.ts';
import { ConflictError, type Doc } from './db.ts';
import { lockId } from './ticketing.ts';

export function ticketId(orderId: string, unitKey: string): string {
  return detId('tk', orderId, unitKey);
}

export function credentialFor(ctx: AppContext, ticket: Doc): string {
  const sig = hmac(ctx.secrets.ticketSigning, credentialMessage(ticket.$id, String(ticket.nonce)));
  return formatCredential(ticket.$id, String(ticket.nonce), sig);
}

/**
 * Issues tickets for a paid order. Safe to call repeatedly: ticket IDs are deterministic per (order, unit),
 * so a duplicate payment event cannot create duplicate tickets.
 */
export async function issueTicketsForOrder(ctx: AppContext, order: Doc): Promise<{ ok: boolean; issued: number; reason?: string }> {
  if (order.state !== 'paid') return { ok: false, issued: 0, reason: 'order not paid' };
  const now = ctx.now();
  const items = await ctx.db.list(COL.orderItems, { where: [['order_id', 'eq', order.$id]] });
  const match = await ctx.db.get(COL.matches, String(order.match_id));
  // Re-secure inventory: locks may have expired if the provider was slow. Re-acquire as sold.
  const lostUnits: string[] = [];
  for (const it of items) {
    const id = lockId(String(it.offer_id), String(it.unit_key));
    const lock = await ctx.db.get(COL.locks, id);
    const soldData = {
      offer_id: String(it.offer_id),
      match_id: String(order.match_id),
      unit_key: String(it.unit_key),
      hold_id: String(order.hold_id),
      order_id: order.$id,
      user_id: String(order.user_id),
      state: 'sold',
      expires_at: '2999-01-01T00:00:00.000Z',
    };
    if (!lock) {
      try {
        await ctx.db.create(COL.locks, id, soldData);
      } catch (e) {
        if (e instanceof ConflictError) lostUnits.push(String(it.unit_key));
        else throw e;
      }
    } else if (lock.order_id === order.$id) {
      if (lock.state !== 'sold') await ctx.db.update(COL.locks, id, { state: 'sold', expires_at: soldData.expires_at });
    } else if (lock.state === 'held' && Date.parse(String(lock.expires_at)) <= now.getTime()) {
      try {
        await ctx.db.delete(COL.locks, id);
        await ctx.db.create(COL.locks, id, soldData);
      } catch {
        lostUnits.push(String(it.unit_key));
      }
    } else {
      lostUnits.push(String(it.unit_key));
    }
  }
  if (lostUnits.length) {
    // Paid, but inventory was lost to another buyer while the hold was expired: never issue, flag for refund.
    await ctx.db.update(COL.orders, order.$id, {
      state: 'refund_pending',
      note: `Inventory no longer available for unit(s) ${lostUnits.join(', ')}; refund required`,
    });
    return { ok: false, issued: 0, reason: 'inventory lost; order moved to refund_pending' };
  }
  let issued = 0;
  for (const it of items) {
    const id = ticketId(order.$id, String(it.unit_key));
    try {
      await ctx.db.create(
        COL.tickets,
        id,
        {
          order_id: order.$id,
          user_id: String(order.user_id),
          match_id: String(order.match_id),
          offer_id: String(it.offer_id),
          unit_key: String(it.unit_key),
          section_name: String(it.section_name),
          seat_label: it.seat_label ?? null,
          state: 'active',
          nonce: randomId().slice(0, 20),
          issued_at: now.toISOString(),
          used_at: null,
        },
        userReadPermission(String(order.user_id)),
      );
      issued++;
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e; // already issued: exactly-once
    }
  }
  await queueDelivery(ctx, order, match);
  return { ok: true, issued };
}

export async function refundTicketsForOrder(ctx: AppContext, orderId: string) {
  const tickets = await ctx.db.list(COL.tickets, { where: [['order_id', 'eq', orderId]] });
  for (const t of tickets) {
    if (t.state === 'refunded') continue;
    try {
      assertTicketTransition(t.state as never, t.state === 'active' ? 'refund_pending' : (t.state as never));
      await ctx.db.update(COL.tickets, t.$id, { state: 'refunded' });
    } catch {
      /* used tickets stay used */
    }
    // free the inventory
    try {
      await ctx.db.delete(COL.locks, lockId(String(t.offer_id), String(t.unit_key)));
    } catch {
      /* ignore */
    }
  }
}

/* --------------------------------- delivery --------------------------------- */

async function queueDelivery(ctx: AppContext, order: Doc, match: Doc | null) {
  const to = order.purchaser_email ? String(order.purchaser_email) : null;
  if (!to) return;
  const id = detId('dl', order.$id);
  try {
    await ctx.db.create(
      COL.deliveries,
      id,
      { order_id: order.$id, ticket_id: null, channel: 'email', to, state: 'queued', attempts: 0, last_error: null, next_attempt_at: ctx.now().toISOString(), sent_at: null },
      userReadPermission(String(order.user_id)),
    );
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    return; // already queued/sent
  }
  await attemptDelivery(ctx, (await ctx.db.get(COL.deliveries, id)) as Doc, match);
}

export async function attemptDelivery(ctx: AppContext, delivery: Doc, match?: Doc | null) {
  const order = await ctx.db.get(COL.orders, String(delivery.order_id));
  if (!order) return;
  const tickets = await ctx.db.list(COL.tickets, { where: [['order_id', 'eq', order.$id]] });
  const m = match ?? (await ctx.db.get(COL.matches, String(order.match_id)));
  const lines = tickets.map((t) => `- ${t.section_name}${t.seat_label ? ` seat ${t.seat_label}` : ''} (ticket ${t.$id})`);
  const text = [
    'Your LinkUp tickets are confirmed.',
    m ? `Match: ${m.round_label || ''} ${m.kickoff_at}` : '',
    `Order ${order.$id} - ${formatMoney(Number(order.total_minor), String(order.currency) as never)}`,
    '',
    ...lines,
    '',
    'Open the LinkUp app to show your QR code at the gate.',
  ].join('\n');
  const html = `<p>${text.replace(/\n/g, '<br/>')}</p>`;
  const result = await ctx.email.send({ to: String(delivery.to), userId: String(order.user_id), subject: 'Your LinkUp tickets', text, html });
  const attempts = Number(delivery.attempts) + 1;
  if (result.sent) {
    await ctx.db.update(COL.deliveries, delivery.$id, { state: 'sent', attempts, sent_at: ctx.now().toISOString(), last_error: null, next_attempt_at: null });
    return;
  }
  const backoffMin = Math.min(60, 2 ** attempts);
  await ctx.db.update(COL.deliveries, delivery.$id, {
    state: attempts >= 8 ? 'failed' : attempts === 1 ? 'queued' : 'retry',
    attempts,
    last_error: (result.error ?? 'send failed').slice(0, 500),
    next_attempt_at: new Date(ctx.now().getTime() + backoffMin * 60_000).toISOString(),
  });
}

export async function retryDeliveries(ctx: AppContext): Promise<number> {
  const now = ctx.now().toISOString();
  const due = await ctx.db.list(COL.deliveries, { where: [['state', 'in', ['queued', 'retry']]], limit: 100 });
  let n = 0;
  for (const d of due) {
    if (d.next_attempt_at && String(d.next_attempt_at) > now) continue;
    await attemptDelivery(ctx, d);
    n++;
  }
  return n;
}

export async function retryDelivery(ctx: AppContext, req: RequestContext, deliveryId: string) {
  const userId = requireUser(req);
  const d = mustGet(await ctx.db.get(COL.deliveries, deliveryId), 'Delivery');
  const order = mustGet(await ctx.db.get(COL.orders, String(d.order_id)), 'Order');
  if (order.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
  if (d.state === 'sent') return publicDoc(d);
  await ctx.db.update(COL.deliveries, d.$id, { state: 'retry', next_attempt_at: ctx.now().toISOString() });
  await attemptDelivery(ctx, (await ctx.db.get(COL.deliveries, d.$id)) as Doc);
  return publicDoc((await ctx.db.get(COL.deliveries, d.$id)) as Doc);
}

/* ------------------------------ user-facing read ------------------------------ */

export async function getTicket(ctx: AppContext, req: RequestContext, id: string) {
  const userId = requireUser(req);
  const t = mustGet(await ctx.db.get(COL.tickets, id), 'Ticket');
  if (t.user_id !== userId) throw new DomainError('forbidden', 'Not your ticket', 403);
  const match = await ctx.db.get(COL.matches, String(t.match_id));
  const order = await ctx.db.get(COL.orders, String(t.order_id));
  const deliveries = await ctx.db.list(COL.deliveries, { where: [['order_id', 'eq', String(t.order_id)]] });
  const { nonce: _n, ...rest } = publicDoc(t);
  return {
    ticket: rest,
    credential: t.state === 'active' ? credentialFor(ctx, t) : null,
    match: match ? publicDoc(match) : null,
    order: order ? { id: order.$id, state: order.state, total_minor: order.total_minor, currency: order.currency } : null,
    delivery: deliveries[0] ? publicDoc(deliveries[0]) : null,
  };
}

/* --------------------------------- validation --------------------------------- */

export async function validateTicket(ctx: AppContext, req: RequestContext, body: Record<string, unknown>) {
  const actor = await requireAdmin(ctx, req);
  const parsed = parseCredential(body.credential);
  if (!parsed) throw new DomainError('invalid_credential', 'Unrecognised ticket code', 400);
  const t = await ctx.db.get(COL.tickets, parsed.ticketId);
  if (!t) throw new DomainError('invalid_credential', 'Unrecognised ticket code', 400);
  const expected = hmac(ctx.secrets.ticketSigning, credentialMessage(t.$id, String(t.nonce)));
  if (!safeEqual(expected, parsed.signature) || parsed.nonce !== String(t.nonce)) {
    throw new DomainError('invalid_credential', 'Ticket signature does not match', 400);
  }
  const state = String(t.state);
  if (state === 'used') throw new DomainError('already_used', `Ticket already used at ${t.used_at}`, 409);
  if (state !== 'active') throw new DomainError('ticket_inactive', `Ticket is ${state}`, 410);
  if (body.dryRun === true) return { ok: true, state, ticket: summary(t) };
  assertTicketTransition('active', 'used');
  await ctx.db.update(COL.tickets, t.$id, { state: 'used', used_at: ctx.now().toISOString() });
  ctx.log(`ticket ${t.$id} validated by ${actor}`);
  return { ok: true, state: 'used', ticket: summary(t) };
}

function summary(t: Doc) {
  return { id: t.$id, match_id: t.match_id, section_name: t.section_name, seat_label: t.seat_label ?? null, issued_at: t.issued_at };
}

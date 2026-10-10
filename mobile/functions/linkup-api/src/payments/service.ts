/**
 * Payment event processing: signed-event verification, idempotency, amount/currency checks,
 * out-of-order tolerance, exactly-once ticket issuance.
 */
import { DomainError } from '../../../../lib/competition/states.ts';
import { assertAttemptTransition, assertOrderTransition, canOrderTransition } from '../../../../lib/ticketing/states.ts';
import { COL, detId, mustGet, requireUser, type AppContext, type RequestContext } from '../context.ts';
import { ConflictError, type Doc } from '../db.ts';
import { issueTicketsForOrder, refundTicketsForOrder } from '../tickets.ts';
import type { ProviderEvent } from './adapter.ts';
import { FakeProvider } from './fake.ts';

export interface WebhookResult {
  status: number;
  body: { ok: boolean; result: string; order_id?: string };
}

async function findOrderByRef(ctx: AppContext, providerRef: string): Promise<Doc | null> {
  const byOrder = await ctx.db.list(COL.orders, { where: [['provider_ref', 'eq', providerRef]], limit: 1 });
  if (byOrder[0]) return byOrder[0];
  const byAttempt = await ctx.db.list(COL.attempts, { where: [['provider_ref', 'eq', providerRef]], limit: 1 });
  if (byAttempt[0]) return ctx.db.get(COL.orders, String(byAttempt[0].order_id));
  return null;
}

async function setAttemptState(ctx: AppContext, orderId: string, providerRef: string, state: 'succeeded' | 'failed' | 'cancelled' | 'pending', reason?: string) {
  const attempts = await ctx.db.list(COL.attempts, { where: [['order_id', 'eq', orderId]] });
  const a = attempts.find((x) => x.provider_ref === providerRef) ?? attempts[0];
  if (!a) return;
  try {
    assertAttemptTransition(a.state as never, state);
    await ctx.db.update(COL.attempts, a.$id, { state, updated_at: ctx.now().toISOString(), failure_reason: reason ?? null });
  } catch {
    /* terminal attempt: keep */
  }
}

/**
 * Applies a verified provider outcome to an order. Idempotent: re-applying the same outcome is a no-op,
 * and a stale "failed" after "succeeded" is ignored.
 */
export async function applyPaymentOutcome(ctx: AppContext, order: Doc, event: ProviderEvent): Promise<string> {
  const state = String(order.state);
  if (event.type === 'payment.succeeded') {
    if (Number(order.total_minor) !== event.amountMinor || String(order.currency) !== event.currency) {
      await setAttemptState(ctx, order.$id, event.providerRef, 'failed', 'amount/currency mismatch');
      return `rejected: amount/currency mismatch (expected ${order.total_minor} ${order.currency}, got ${event.amountMinor} ${event.currency})`;
    }
    if (['paid', 'cancellation_requested', 'refund_pending', 'partially_refunded', 'refunded', 'refund_failed'].includes(state)) {
      return 'ignored: order already paid';
    }
    if (!canOrderTransition(state as never, 'paid')) {
      // e.g. cancelled or expired: funds captured for an order we cannot fulfil -> flag for refund
      await ctx.db.update(COL.orders, order.$id, { note: `Payment received for ${state} order; manual refund required` });
      return `flagged: payment for ${state} order`;
    }
    assertOrderTransition(state as never, 'paid');
    await ctx.db.update(COL.orders, order.$id, { state: 'paid', paid_at: ctx.now().toISOString(), provider_ref: event.providerRef });
    await setAttemptState(ctx, order.$id, event.providerRef, 'succeeded');
    const issued = await issueTicketsForOrder(ctx, { ...order, state: 'paid' });
    return issued.ok ? `paid: issued ${issued.issued} ticket(s)` : `paid but ${issued.reason}`;
  }
  if (event.type === 'payment.failed' || event.type === 'payment.cancelled') {
    if (state !== 'pending') return `ignored: ${event.type} for ${state} order`;
    assertOrderTransition('pending', 'failed');
    await ctx.db.update(COL.orders, order.$id, { state: 'failed' });
    await setAttemptState(ctx, order.$id, event.providerRef, event.type === 'payment.failed' ? 'failed' : 'cancelled', event.type);
    return 'failed';
  }
  if (event.type === 'payment.pending') {
    await setAttemptState(ctx, order.$id, event.providerRef, 'pending');
    return 'pending';
  }
  if (event.type === 'refund.succeeded') {
    if (!['refund_pending', 'cancellation_requested', 'paid'].includes(state)) return `ignored: refund for ${state} order`;
    await ctx.db.update(COL.orders, order.$id, { state: 'refunded' });
    await refundTicketsForOrder(ctx, order.$id);
    return 'refunded';
  }
  if (event.type === 'refund.failed') {
    if (state !== 'refund_pending') return `ignored: refund failure for ${state} order`;
    await ctx.db.update(COL.orders, order.$id, { state: 'refund_failed' });
    return 'refund_failed';
  }
  return 'ignored: unknown event type';
}

export async function handleWebhook(ctx: AppContext, rawBody: string, headers: Record<string, string>): Promise<WebhookResult> {
  const verified = await ctx.provider.verifyEvent(rawBody, headers);
  const receivedAt = ctx.now().toISOString();
  if (!verified.valid || !verified.event) {
    // record the rejection (append-only), but never act on it
    await ctx.db.create(COL.events, detId('pe', ctx.provider.id, 'invalid', receivedAt, rawBody.slice(0, 64)), {
      provider: ctx.provider.id,
      provider_event_id: 'invalid',
      order_id: null,
      type: 'invalid',
      payload_json: rawBody.slice(0, 20000),
      signature_valid: false,
      processed: false,
      result: verified.reason ?? 'invalid',
      received_at: receivedAt,
    });
    return { status: 400, body: { ok: false, result: 'invalid signature' } };
  }
  const ev = verified.event;
  const eventDocId = detId('pe', ctx.provider.id, ev.id);
  const order = await findOrderByRef(ctx, ev.providerRef);
  try {
    await ctx.db.create(COL.events, eventDocId, {
      provider: ctx.provider.id,
      provider_event_id: ev.id,
      order_id: order?.$id ?? null,
      type: ev.type,
      payload_json: JSON.stringify(ev.raw).slice(0, 20000),
      signature_valid: true,
      processed: false,
      result: null,
      received_at: receivedAt,
    });
  } catch (e) {
    if (e instanceof ConflictError) return { status: 200, body: { ok: true, result: 'duplicate: already received', order_id: order?.$id } };
    throw e;
  }
  let result: string;
  if (!order) result = 'ignored: unknown order';
  else {
    try {
      result = await applyPaymentOutcome(ctx, order, ev);
    } catch (e) {
      result = `error: ${(e as Error).message}`;
    }
  }
  await ctx.db.update(COL.events, eventDocId, { processed: true, result: result.slice(0, 300) });
  return { status: 200, body: { ok: true, result, order_id: order?.$id } };
}

/** Return-before-event: query the provider instead of trusting the redirect. */
export async function syncOrder(ctx: AppContext, req: RequestContext, orderId: string) {
  const userId = requireUser(req);
  const order = mustGet(await ctx.db.get(COL.orders, orderId), 'Order');
  if (order.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
  if (order.state !== 'pending' || !order.provider_ref) return { state: order.state, synced: false };
  const remote = await ctx.provider.fetchPaymentState(String(order.provider_ref));
  if (remote.state === 'unknown' || remote.state === 'pending') return { state: order.state, synced: true, provider_state: remote.state };
  const type = remote.state === 'succeeded' ? 'payment.succeeded' : remote.state === 'cancelled' ? 'payment.cancelled' : 'payment.failed';
  const synthetic: ProviderEvent = {
    id: `sync:${order.provider_ref}:${remote.state}`,
    type,
    providerRef: String(order.provider_ref),
    amountMinor: remote.amountMinor ?? Number(order.total_minor),
    currency: (remote.currency ?? String(order.currency)) as never,
    occurredAt: ctx.now().toISOString(),
    raw: { source: 'sync', remote },
  };
  // same idempotent path as a webhook
  const eventDocId = detId('pe', ctx.provider.id, synthetic.id);
  let result = 'duplicate';
  try {
    await ctx.db.create(COL.events, eventDocId, {
      provider: ctx.provider.id,
      provider_event_id: synthetic.id,
      order_id: order.$id,
      type: synthetic.type,
      payload_json: JSON.stringify(synthetic.raw),
      signature_valid: true,
      processed: false,
      result: null,
      received_at: synthetic.occurredAt,
    });
    result = await applyPaymentOutcome(ctx, order, synthetic);
    await ctx.db.update(COL.events, eventDocId, { processed: true, result });
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
  }
  const fresh = await ctx.db.get(COL.orders, orderId);
  return { state: fresh?.state, synced: true, provider_state: remote.state, result };
}

/**
 * Fake provider only: simulates what the hosted checkout page would do, then pushes the signed event
 * through the SAME webhook path. Never available with a live provider.
 */
export async function fakeComplete(ctx: AppContext, req: RequestContext, body: Record<string, unknown>) {
  const userId = requireUser(req);
  if (!(ctx.provider instanceof FakeProvider)) throw new DomainError('not_available', 'Test checkout is not enabled', 404);
  const attemptId = String(body.attemptId || '');
  const outcome = String(body.outcome || '');
  const attempt = mustGet(await ctx.db.get(COL.attempts, attemptId), 'Payment attempt');
  const order = mustGet(await ctx.db.get(COL.orders, String(attempt.order_id)), 'Order');
  if (order.user_id !== userId) throw new DomainError('forbidden', 'Not your order', 403);
  const providerRef = String(attempt.provider_ref);
  const amount = body.amountOverride != null ? Number(body.amountOverride) : Number(attempt.amount_minor);
  const typeMap: Record<string, ProviderEvent['type']> = {
    success: 'payment.succeeded',
    decline: 'payment.failed',
    cancel: 'payment.cancelled',
    pending: 'payment.pending',
  };
  const type = typeMap[outcome];
  if (!type) throw new DomainError('invalid_input', 'outcome must be success | decline | cancel | pending');
  const fake = ctx.provider as FakeProvider;
  // provider-side state first (so /sync agrees with the event)
  const providerState = outcome === 'success' ? 'succeeded' : outcome === 'decline' ? 'failed' : outcome === 'cancel' ? 'cancelled' : 'pending';
  await fake.store.setState(providerRef, providerState);
  const signed = fake.signEvent({
    id: `evt_${attemptId}_${outcome}_${body.eventSuffix ?? '1'}`,
    type,
    providerRef,
    amountMinor: amount,
    currency: String(attempt.currency) as never,
  });
  if (body.deliverEvent === false) return { ok: true, delivered: false, provider_state: providerState };
  const res = await handleWebhook(ctx, signed.body, signed.headers);
  return { ok: res.body.ok, delivered: true, webhook: res.body, provider_state: providerState };
}

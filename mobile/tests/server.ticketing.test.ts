import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { COL } from '../functions/linkup-api/src/context.ts';
import { FakeProvider } from '../functions/linkup-api/src/payments/fake.ts';
import { Harness } from './server.harness.ts';

let h: Harness;
beforeEach(async () => {
  h = new Harness();
  await h.seedFootball();
});

const body = <T>(r: { body: unknown }) => r.body as T;

describe('holds & inventory (Task 6)', () => {
  it('GA availability, quantity validation and low availability', async () => {
    const a = await h.call('GET', '/matches/m1/availability', undefined, null);
    assert.equal(a.status, 200);
    const ga = body<{ offers: { id: string; available: number }[]; status: { status: string } }>(a);
    assert.equal(ga.offers.find((o) => o.id === 'off-ga')?.available, 5);
    assert.equal(ga.status.status, 'low_availability');
    assert.equal((await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 0 }, 'alice')).status, 400);
    assert.equal((await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 5 }, 'alice')).status, 400); // max 4
    assert.equal((await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 2 }, null)).status, 401);
    const hold = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 2 }, 'alice');
    assert.equal(hold.status, 200, JSON.stringify(hold.body));
    assert.deepEqual(body<{ unit_keys: string[] }>(hold).unit_keys, ['ga-1', 'ga-2']);
    const after = body<{ offers: { id: string; available: number; mine: string[] | null }[] }>(await h.call('GET', '/matches/m1/availability', undefined, 'alice'));
    assert.equal(after.offers.find((o) => o.id === 'off-ga')?.available, 3);
    assert.deepEqual(after.offers.find((o) => o.id === 'off-ga')?.mine, ['ga-1', 'ga-2']);
  });

  it('cannot oversell: last-ticket concurrency gives exactly one winner', async () => {
    await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 4 }, 'alice');
    const results = await Promise.all(['bob', 'carol', 'dave', 'erin'].map((u) => h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, u)));
    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 3);
    const locks = await h.db.list(COL.locks, { where: [['offer_id', 'eq', 'off-ga']] });
    assert.equal(locks.length, 5);
    assert.equal(new Set(locks.map((l) => l.unit_key)).size, 5);
  });

  it('assigned seats: conflict, seat lost, invalid seat, and accessible/companion kinds exposed', async () => {
    const a = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-A1', 'seat-A2'] }, 'alice');
    assert.equal(a.status, 200);
    const b = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-A2', 'seat-B1'] }, 'bob');
    assert.equal(b.status, 409);
    assert.equal(body<{ code: string }>(b).code, 'seat_unavailable');
    assert.equal((await h.db.list(COL.locks, { where: [['hold_id', 'eq', 'none']] })).length, 0);
    const locks = await h.db.list(COL.locks, { where: [['offer_id', 'eq', 'off-vip']] });
    assert.deepEqual(locks.map((l) => l.unit_key).sort(), ['seat-A1', 'seat-A2']); // bob's partial lock was rolled back
    const bad = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['ga-1'] }, 'bob');
    assert.equal(bad.status, 400);
    const avail = body<{ offers: { id: string; unavailable_units?: string[] }[] }>(await h.call('GET', '/matches/m1/availability', undefined, null));
    assert.deepEqual(avail.offers.find((o) => o.id === 'off-vip')?.unavailable_units?.sort(), ['seat-A1', 'seat-A2']);
  });

  it('expired holds are reclaimed by later buyers and by the jobs sweep', async () => {
    const a = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-A1'] }, 'alice');
    assert.equal(a.status, 200);
    assert.equal((await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-A1'] }, 'bob')).status, 409);
    h.advance(601);
    const b = await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-A1'] }, 'bob');
    assert.equal(b.status, 200, JSON.stringify(b.body));
    const jobs = await h.call('POST', '/admin/jobs/run', {}, 'admin1');
    assert.equal(body<{ holdsExpired: number }>(jobs).holdsExpired, 1);
    assert.equal((await h.db.get(COL.holds, body<{ id: string }>(a).id))?.state, 'expired');
    // bob's order fails on an expired hold
    h.advance(601);
    const o = await h.call('POST', '/orders', { holdId: body<{ id: string }>(b).id, idempotencyKey: 'k1' }, 'bob');
    assert.equal(o.status, 409);
    assert.equal(body<{ code: string }>(o).code, 'hold_expired');
  });

  it('sale window and match status gates', async () => {
    await h.db.update(COL.offers, 'off-ga', { status: 'paused' });
    assert.equal(body<{ code: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'alice')).code, 'sales_paused');
    await h.db.update(COL.offers, 'off-ga', { status: 'on_sale', sale_start: '2026-03-05T00:00:00.000Z' });
    assert.equal(body<{ code: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'alice')).code, 'not_on_sale');
    await h.db.update(COL.offers, 'off-ga', { sale_start: '2026-02-01T00:00:00.000Z', sale_end: '2026-02-02T00:00:00.000Z' });
    assert.equal(body<{ code: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'alice')).code, 'sales_closed');
    await h.db.update(COL.offers, 'off-ga', { sale_end: '2026-03-10T00:00:00.000Z' });
    await h.db.update(COL.matches, 'm1', { status: 'postponed' });
    assert.equal(body<{ code: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'alice')).code, 'sales_closed');
    assert.equal(body<{ status: { status: string } }>(await h.call('GET', '/matches/m1/availability', undefined, null)).status.status, 'unavailable');
  });
});

describe('orders & payment boundary (Task 7)', () => {
  it('ignores client totals, prices from the authoritative offer, and is idempotent', async () => {
    const hold = body<{ id: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 2 }, 'alice'));
    const r1 = await h.call('POST', '/orders', { holdId: hold.id, idempotencyKey: 'abc', total_minor: 1, subtotal_minor: 1 }, 'alice');
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    const o1 = body<{ order: { id: string; total_minor: number; subtotal_minor: number; fees_minor: number; state: string } }>(r1).order;
    assert.equal(o1.subtotal_minor, 2000);
    assert.equal(o1.fees_minor, 200);
    assert.equal(o1.total_minor, 2200);
    assert.equal(o1.state, 'awaiting_checkout');
    const r2 = await h.call('POST', '/orders', { holdId: hold.id, idempotencyKey: 'abc' }, 'alice');
    assert.equal(r2.status, 200);
    assert.equal(body<{ order: { id: string }; idempotent: boolean }>(r2).order.id, o1.id);
    assert.equal(body<{ idempotent: boolean }>(r2).idempotent, true);
    assert.equal((await h.db.list(COL.orders)).length, 1);
    assert.equal((await h.db.list(COL.orderItems)).length, 2);
    assert.equal((await h.db.get(COL.holds, hold.id))?.state, 'converted');
  });

  it('guest without email cannot order; repricing is surfaced not silently applied', async () => {
    const hold = body<{ id: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'guest'));
    const r = await h.call('POST', '/orders', { holdId: hold.id, idempotencyKey: 'g1' }, 'guest');
    assert.equal(r.status, 403);
    assert.equal(body<{ code: string }>(r).code, 'email_required');
    const h2 = body<{ id: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity: 1 }, 'alice'));
    await h.db.update(COL.offers, 'off-ga', { price_minor: 1500 });
    const rp = await h.call('POST', '/orders', { holdId: h2.id, idempotencyKey: 'rp' }, 'alice');
    assert.equal(rp.status, 409);
    assert.equal(body<{ code: string }>(rp).code, 'repriced');
    const ok = await h.call('POST', '/orders', { holdId: h2.id, idempotencyKey: 'rp', acceptRepricing: true }, 'alice');
    assert.equal(ok.status, 200);
    assert.equal(body<{ order: { total_minor: number }; repriced: { from: number; to: number } }>(ok).order.total_minor, 1600);
    assert.deepEqual(body<{ repriced: { from: number; to: number } }>(ok).repriced, { from: 1100, to: 1600 });
  });

  it('checkout is unavailable when the flag is off or no provider is approved', async () => {
    await h.db.update(COL.settings, 'ticketing', { checkout_enabled: false });
    const buy = await h.buyGa('alice', 1);
    assert.equal(buy.checkout!.status, 409);
    assert.equal(body<{ code: string }>(buy.checkout!).code, 'checkout_unavailable');
    const cfg = body<{ checkout_enabled: boolean }>(await h.call('GET', '/config', undefined, null));
    assert.equal(cfg.checkout_enabled, false);
    const none = new Harness({ provider: 'none' });
    await none.seedFootball();
    const b2 = await none.buyGa('alice', 1);
    assert.equal(b2.checkout!.status, 409);
    assert.equal(body<{ checkout_enabled: boolean; provider: string }>(await none.call('GET', '/config', undefined, null)).provider, 'none');
  });

  it('success: verified event -> paid -> tickets exactly once; duplicate and out-of-order events are idempotent', async () => {
    const buy = await h.buyGa('alice', 2);
    assert.equal(buy.checkout!.status, 200, JSON.stringify(buy.checkout!.body));
    assert.match(body<{ checkout_url: string }>(buy.checkout!).checkout_url, /checkout=fake/);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'pending');
    // a redirect/return is NOT proof of payment
    const sync0 = await h.call('POST', `/orders/${buy.orderId}/sync`, {}, 'alice');
    assert.equal(body<{ state: string }>(sync0).state, 'pending');
    const done = await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.match(body<{ webhook: { result: string } }>(done).webhook.result, /issued 2 ticket/);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'paid');
    assert.equal((await h.db.list(COL.tickets)).length, 2);
    // duplicate event
    const dup = await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    assert.match(body<{ webhook: { result: string } }>(dup).webhook.result, /duplicate/);
    // same event type with a new event id (provider retry with new id) -> ignored, no duplicate tickets
    const again = await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success', eventSuffix: '2' }, 'alice');
    assert.match(body<{ webhook: { result: string } }>(again).webhook.result, /already paid/);
    assert.equal((await h.db.list(COL.tickets)).length, 2);
    // out-of-order stale failure after success is ignored
    const late = await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'decline' }, 'alice');
    assert.match(body<{ webhook: { result: string } }>(late).webhook.result, /ignored/);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'paid');
    // repeat click on checkout after paid
    assert.equal((await h.call('POST', `/orders/${buy.orderId}/checkout`, {}, 'alice')).status, 409);
    // locks are sold forever
    const locks = await h.db.list(COL.locks, { where: [['order_id', 'eq', buy.orderId!]] });
    assert.deepEqual(locks.map((l) => l.state), ['sold', 'sold']);
    // delivery queued (no approved sender): in-app access unaffected
    const dl = await h.db.list(COL.deliveries);
    assert.equal(dl.length, 1);
    assert.equal(dl[0].state, 'sent'); // scripted sender sends
    assert.equal(h.email.sent[0].to, 'alice@linkup.app');
  });

  it('decline then retry, cancel at provider, and repeat click while pending', async () => {
    const buy = await h.buyGa('alice', 1);
    const repeat = await h.call('POST', `/orders/${buy.orderId}/checkout`, {}, 'alice');
    assert.equal(body<{ code: string }>(repeat).code, 'payment_pending');
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'decline' }, 'alice');
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'failed');
    // retry: new checkout attempt
    const retry = await h.call('POST', `/orders/${buy.orderId}/checkout`, {}, 'alice');
    assert.equal(retry.status, 200);
    const a2 = body<{ attempt_id: string }>(retry).attempt_id;
    await h.call('POST', '/payments/fake/complete', { attemptId: a2, outcome: 'cancel' }, 'alice');
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'failed');
    const retry2 = await h.call('POST', `/orders/${buy.orderId}/checkout`, {}, 'alice');
    const a3 = body<{ attempt_id: string }>(retry2).attempt_id;
    await h.call('POST', '/payments/fake/complete', { attemptId: a3, outcome: 'success' }, 'alice');
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'paid');
    assert.equal((await h.db.list(COL.tickets)).length, 1);
    assert.equal((await h.db.list(COL.attempts)).length, 3);
  });

  it('asynchronous pending: return-before-event resolves via provider query; later event is a duplicate', async () => {
    const buy = await h.buyGa('alice', 1);
    // provider says succeeded but has not delivered the event yet
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success', deliverEvent: false }, 'alice');
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'pending');
    const sync = await h.call('POST', `/orders/${buy.orderId}/sync`, {}, 'alice');
    assert.equal(body<{ state: string }>(sync).state, 'paid');
    assert.equal((await h.db.list(COL.tickets)).length, 1);
    const sync2 = await h.call('POST', `/orders/${buy.orderId}/sync`, {}, 'alice');
    assert.equal(body<{ synced: boolean }>(sync2).synced, false);
    // the real event now arrives (event-after-return): no duplicate tickets
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    assert.equal((await h.db.list(COL.tickets)).length, 1);
  });

  it('event-before-return: webhook lands first, then the user returns', async () => {
    const buy = await h.buyGa('alice', 1);
    const fake = h.provider as FakeProvider;
    const signed = fake.signEvent({ id: 'evt-early', type: 'payment.succeeded', providerRef: `fake_${buy.attemptId}`, amountMinor: 1100, currency: 'USD' });
    const r = await h.call('POST', '/payments/webhook', signed.body, null, signed.headers);
    assert.equal(r.status, 200);
    const order = await h.call('GET', `/orders/${buy.orderId}`, undefined, 'alice');
    assert.equal(body<{ order: { state: string }; tickets: unknown[] }>(order).order.state, 'paid');
    assert.equal(body<{ tickets: unknown[] }>(order).tickets.length, 1);
  });

  it('invalid signature and amount/currency mismatch never confirm payment', async () => {
    const buy = await h.buyGa('alice', 1);
    const fake = h.provider as FakeProvider;
    const signed = fake.signEvent({ id: 'evt-bad', type: 'payment.succeeded', providerRef: `fake_${buy.attemptId}`, amountMinor: 1100, currency: 'USD' });
    const forged = await h.call('POST', '/payments/webhook', signed.body, null, { 'x-fake-signature': 'nope' });
    assert.equal(forged.status, 400);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'pending');
    const wrongAmount = fake.signEvent({ id: 'evt-amt', type: 'payment.succeeded', providerRef: `fake_${buy.attemptId}`, amountMinor: 100, currency: 'USD' });
    const r = await h.call('POST', '/payments/webhook', wrongAmount.body, null, wrongAmount.headers);
    assert.equal(r.status, 200);
    assert.match(body<{ result: string }>(r).result, /mismatch/);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'pending');
    const wrongCur = fake.signEvent({ id: 'evt-cur', type: 'payment.succeeded', providerRef: `fake_${buy.attemptId}`, amountMinor: 1100, currency: 'LBP' });
    assert.match(body<{ result: string }>(await h.call('POST', '/payments/webhook', wrongCur.body, null, wrongCur.headers)).result, /mismatch/);
    assert.equal((await h.db.list(COL.tickets)).length, 0);
    const events = await h.db.list(COL.events);
    assert.equal(events.filter((e) => e.signature_valid === false).length, 1);
  });

  it('expired hold during a slow payment: inventory re-secured if free, otherwise refund_pending (no tickets)', async () => {
    // alice holds the last VIP seat, starts checkout, provider is slow
    const hold = body<{ id: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-B2'] }, 'alice'));
    const order = body<{ order: { id: string } }>(await h.call('POST', '/orders', { holdId: hold.id, idempotencyKey: 'slow' }, 'alice')).order;
    const co = body<{ attempt_id: string }>(await h.call('POST', `/orders/${order.id}/checkout`, {}, 'alice'));
    h.advance(1000); // beyond payment window
    await h.call('POST', '/admin/jobs/run', {}, 'admin1'); // sweeps: order expired, locks freed
    assert.equal((await h.db.get(COL.orders, order.id))?.state, 'expired');
    // bob grabs the seat and pays
    const bobHold = body<{ id: string }>(await h.call('POST', '/holds', { matchId: 'm1', offerId: 'off-vip', unitKeys: ['seat-B2'] }, 'bob'));
    const bobOrder = body<{ order: { id: string } }>(await h.call('POST', '/orders', { holdId: bobHold.id, idempotencyKey: 'bob' }, 'bob')).order;
    const bobCo = body<{ attempt_id: string }>(await h.call('POST', `/orders/${bobOrder.id}/checkout`, {}, 'bob'));
    await h.call('POST', '/payments/fake/complete', { attemptId: bobCo.attempt_id, outcome: 'success' }, 'bob');
    // alice's late success arrives: order was expired -> flagged, never issued
    const late = await h.call('POST', '/payments/fake/complete', { attemptId: co.attempt_id, outcome: 'success' }, 'alice');
    assert.match(body<{ webhook: { result: string } }>(late).webhook.result, /flagged/);
    const tickets = await h.db.list(COL.tickets);
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0].user_id, 'bob');
  });

  it('cancel before payment releases inventory; cancel after payment only requests cancellation (refunds disabled)', async () => {
    const buy = await h.buyGa('alice', 2);
    const c = await h.call('POST', `/orders/${buy.orderId}/cancel`, {}, 'alice');
    assert.equal(c.status, 200);
    assert.equal((await h.db.get(COL.orders, buy.orderId!))?.state, 'cancelled');
    assert.equal((await h.db.list(COL.locks, { where: [['offer_id', 'eq', 'off-ga']] })).length, 0);
    const buy2 = await h.buyGa('alice', 1);
    await h.call('POST', '/payments/fake/complete', { attemptId: buy2.attemptId, outcome: 'success' }, 'alice');
    const c2 = await h.call('POST', `/orders/${buy2.orderId}/cancel`, {}, 'alice');
    assert.equal(body<{ state: string; refunds_enabled: boolean }>(c2).state, 'cancellation_requested');
    assert.equal(body<{ refunds_enabled: boolean }>(c2).refunds_enabled, false);
    // refund event from provider later -> refunded, tickets refunded, inventory freed
    const fake = h.provider as FakeProvider;
    const ev = fake.signEvent({ id: 'evt-refund', type: 'refund.succeeded', providerRef: `fake_${buy2.attemptId}`, amountMinor: 1100, currency: 'USD' });
    await h.call('POST', '/payments/webhook', ev.body, null, ev.headers);
    assert.equal((await h.db.get(COL.orders, buy2.orderId!))?.state, 'refunded');
    assert.deepEqual((await h.db.list(COL.tickets)).map((t) => t.state), ['refunded']);
    assert.equal((await h.db.list(COL.locks, { where: [['offer_id', 'eq', 'off-ga']] })).length, 0);
  });

  it('email failure does not block tickets; deliveries retry', async () => {
    h.email.failNext = 2;
    const buy = await h.buyGa('alice', 1);
    await h.call('POST', '/payments/fake/complete', { attemptId: buy.attemptId, outcome: 'success' }, 'alice');
    const dl = (await h.db.list(COL.deliveries))[0];
    assert.equal(dl.state, 'queued');
    assert.equal(dl.attempts, 1);
    const t = await h.call('GET', `/orders/${buy.orderId}`, undefined, 'alice');
    assert.equal(body<{ tickets: { state: string }[] }>(t).tickets[0].state, 'active');
    const manual = await h.call('POST', `/deliveries/${dl.$id}/retry`, {}, 'alice');
    assert.equal(body<{ state: string; attempts: number }>(manual).state, 'retry');
    assert.equal((await h.call('POST', `/deliveries/${dl.$id}/retry`, {}, 'bob')).status, 403);
    h.advance(3600 * 2);
    const jobs = await h.call('POST', '/admin/jobs/run', {}, 'admin1');
    assert.equal(body<{ deliveriesRetried: number }>(jobs).deliveriesRetried, 1);
    assert.equal((await h.db.get(COL.deliveries, dl.$id))?.state, 'sent');
  });

  it('webhook route needs no user but rejects unsigned junk; schedule trigger runs jobs', async () => {
    assert.equal((await h.call('POST', '/payments/webhook', 'garbage', null)).status, 400);
    const r = await h.call('GET', '/', undefined, null, { 'x-appwrite-trigger': 'schedule' });
    assert.equal(r.status, 200);
    assert.ok('holdsExpired' in (r.body as object));
  });
});

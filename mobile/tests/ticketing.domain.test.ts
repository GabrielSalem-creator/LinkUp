import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addMoney,
  assertHoldTransition,
  assertOrderTransition,
  assertTicketTransition,
  computeOrderTotals,
  credentialMessage,
  deriveMatchTicketStatus,
  evaluateOfferWindow,
  formatCredential,
  formatMoney,
  isOrderPayable,
  money,
  multiplyMoney,
  parseCredential,
  validateMinor,
  validateQuantity,
} from '../lib/ticketing/index.ts';
import type { OfferStatus } from '../lib/ticketing/index.ts';

describe('money', () => {
  it('accepts only integer minor units with a supported currency', () => {
    assert.deepEqual(money(1500, 'USD'), { amountMinor: 1500, currency: 'USD' });
    assert.throws(() => money(15.5, 'USD'), /minor units/);
    assert.throws(() => money(-1, 'USD'), /minor units/);
    assert.throws(() => money(Number.NaN, 'USD'), /minor units/);
    assert.throws(() => money(100, 'XYZ' as never), /Unsupported currency/);
    assert.throws(() => validateMinor('100'), /minor units/);
  });
  it('adds and multiplies without mixing currencies', () => {
    assert.equal(addMoney(money(100, 'USD'), money(250, 'USD')).amountMinor, 350);
    assert.throws(() => addMoney(money(100, 'USD'), money(100, 'LBP')), /different currencies/);
    assert.equal(multiplyMoney(money(1250, 'USD'), 3).amountMinor, 3750);
    assert.throws(() => multiplyMoney(money(1250, 'USD'), 1.5), /Quantity/);
  });
  it('formats by currency decimals', () => {
    assert.equal(formatMoney(1250, 'USD'), '$12.50');
    assert.equal(formatMoney(1500000, 'LBP'), 'LBP 1,500,000');
    assert.equal(formatMoney(999, 'EUR'), '€9.99');
  });
});

describe('pricing', () => {
  it('computes authoritative totals and rejects bad lines', () => {
    const t = computeOrderTotals([
      { unitPriceMinor: 1000, feeMinor: 100, quantity: 2, currency: 'USD' },
      { unitPriceMinor: 2500, feeMinor: 0, quantity: 1, currency: 'USD' },
    ]);
    assert.deepEqual(t, { subtotalMinor: 4500, feesMinor: 200, totalMinor: 4700, currency: 'USD', quantity: 3 });
    assert.throws(() => computeOrderTotals([]), /no items/);
    assert.throws(
      () =>
        computeOrderTotals([
          { unitPriceMinor: 1000, feeMinor: 0, quantity: 1, currency: 'USD' },
          { unitPriceMinor: 1000, feeMinor: 0, quantity: 1, currency: 'LBP' },
        ]),
      /Mixed currencies/,
    );
    assert.throws(() => computeOrderTotals([{ unitPriceMinor: 10.5, feeMinor: 0, quantity: 1, currency: 'USD' }]), /unit price/);
    assert.throws(() => computeOrderTotals([{ unitPriceMinor: 10, feeMinor: 0, quantity: 0, currency: 'USD' }]), /Quantity/);
  });
  it('evaluates sale windows and statuses', () => {
    const base = { status: 'on_sale' as const, sale_start: '2026-01-01T00:00:00Z', sale_end: '2026-02-01T00:00:00Z' };
    assert.deepEqual(evaluateOfferWindow(base, new Date('2026-01-15T00:00:00Z')), { sellable: true });
    assert.equal(evaluateOfferWindow(base, new Date('2025-12-31T00:00:00Z')).reason, 'before_window');
    assert.equal(evaluateOfferWindow(base, new Date('2026-03-01T00:00:00Z')).reason, 'after_window');
    assert.equal(evaluateOfferWindow({ ...base, status: 'paused' }, new Date('2026-01-15T00:00:00Z')).reason, 'paused');
    assert.equal(evaluateOfferWindow({ ...base, status: 'draft' }, new Date('2026-01-15T00:00:00Z')).reason, 'draft');
  });
  it('validates quantity against max per order', () => {
    assert.equal(validateQuantity({ max_per_order: 6 }, 3), 3);
    assert.throws(() => validateQuantity({ max_per_order: 6 }, 7), /Maximum 6/);
    assert.throws(() => validateQuantity({ max_per_order: 6 }, 0), /at least 1/);
    assert.throws(() => validateQuantity({ max_per_order: 6 }, 1.2), /at least 1/);
  });
  it('derives match ticket status', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    const offer = (p: number, status: OfferStatus = 'on_sale', start = '2026-01-01T00:00:00Z', end = '2026-02-01T00:00:00Z') => ({
      status,
      sale_start: start,
      sale_end: end,
      price_minor: p,
      currency: 'USD' as const,
    });
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000), offer(1000)], [50, 5], now).status, 'available');
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000), offer(1000)], [50, 5], now).fromMinor, 1000);
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000), offer(1000)], [50, 0], now).fromMinor, 2000);
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000)], [3], now).status, 'low_availability');
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000)], [0], now).status, 'sold_out');
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000, 'on_sale', '2026-01-20T00:00:00Z')], [10], now).status, 'not_on_sale');
    assert.equal(deriveMatchTicketStatus('scheduled', [offer(2000, 'closed')], [10], now).status, 'sales_closed');
    assert.equal(deriveMatchTicketStatus('final', [offer(2000)], [10], now).status, 'sales_closed');
    assert.equal(deriveMatchTicketStatus('cancelled', [offer(2000)], [10], now).status, 'unavailable');
    assert.equal(deriveMatchTicketStatus('postponed', [offer(2000)], [10], now).status, 'unavailable');
    assert.equal(deriveMatchTicketStatus('scheduled', [], [], now).status, 'unavailable');
  });
});

describe('state machines', () => {
  it('orders', () => {
    assertOrderTransition('awaiting_checkout', 'pending');
    assertOrderTransition('pending', 'paid');
    assertOrderTransition('paid', 'cancellation_requested');
    assertOrderTransition('cancellation_requested', 'refund_pending');
    assertOrderTransition('refund_pending', 'refunded');
    assertOrderTransition('refund_pending', 'refund_failed');
    assertOrderTransition('failed', 'pending');
    assert.throws(() => assertOrderTransition('paid', 'pending'), /cannot move/);
    assert.throws(() => assertOrderTransition('refunded', 'paid'), /cannot move/);
    assert.throws(() => assertOrderTransition('cancelled', 'paid'), /cannot move/);
    assert.ok(isOrderPayable('awaiting_checkout'));
    assert.ok(!isOrderPayable('paid'));
  });
  it('holds and tickets', () => {
    assertHoldTransition('active', 'converted');
    assert.throws(() => assertHoldTransition('expired', 'active'));
    assertTicketTransition('issuing', 'active');
    assertTicketTransition('active', 'used');
    assert.throws(() => assertTicketTransition('used', 'active'));
    assert.throws(() => assertTicketTransition('refunded', 'active'));
  });
});

describe('ticket credential', () => {
  it('formats and parses opaque credentials without PII', () => {
    const c = formatCredential('tk_abc', 'n0nce', 'sig');
    assert.equal(c, 'LKT1.tk_abc.n0nce.sig');
    assert.deepEqual(parseCredential(c), { ticketId: 'tk_abc', nonce: 'n0nce', signature: 'sig' });
    assert.equal(parseCredential('LKT0.a.b.c'), null);
    assert.equal(parseCredential('LKT1.a.b'), null);
    assert.equal(parseCredential('LKT1.a b.c.d'), null);
    assert.equal(parseCredential(42), null);
    assert.equal(credentialMessage('t', 'n'), 'LKT1:t:n');
  });
});

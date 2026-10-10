import { DomainError } from '../competition/states.ts';
import { assertCurrency, validateMinor } from './money.ts';
import type { Currency, MatchTicketStatus, OfferStatus, TicketOffer } from './types.ts';

export interface PricedLine {
  unitPriceMinor: number;
  feeMinor: number;
  quantity: number;
  currency: Currency;
}

export interface OrderTotals {
  subtotalMinor: number;
  feesMinor: number;
  totalMinor: number;
  currency: Currency;
  quantity: number;
}

/** Authoritative totals. Client-supplied totals are never trusted. */
export function computeOrderTotals(lines: PricedLine[]): OrderTotals {
  if (!lines.length) throw new DomainError('empty_order', 'Order has no items');
  const currency = lines[0].currency;
  assertCurrency(currency);
  let subtotal = 0;
  let fees = 0;
  let quantity = 0;
  for (const l of lines) {
    if (l.currency !== currency) throw new DomainError('currency_mismatch', 'Mixed currencies in one order');
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) {
      throw new DomainError('invalid_quantity', 'Quantity must be a positive integer');
    }
    subtotal += validateMinor(l.unitPriceMinor, 'unit price') * l.quantity;
    fees += validateMinor(l.feeMinor, 'fee') * l.quantity;
    quantity += l.quantity;
  }
  return { subtotalMinor: subtotal, feesMinor: fees, totalMinor: subtotal + fees, currency, quantity };
}

export interface OfferWindowResult {
  sellable: boolean;
  reason?: 'draft' | 'paused' | 'closed' | 'sold_out' | 'before_window' | 'after_window';
}

export function evaluateOfferWindow(
  offer: Pick<TicketOffer, 'status' | 'sale_start' | 'sale_end'>,
  now: Date,
): OfferWindowResult {
  const blocked: Partial<Record<OfferStatus, OfferWindowResult['reason']>> = {
    draft: 'draft',
    paused: 'paused',
    closed: 'closed',
    sold_out: 'sold_out',
  };
  const r = blocked[offer.status];
  if (r) return { sellable: false, reason: r };
  const t = now.getTime();
  if (Date.parse(offer.sale_start) > t) return { sellable: false, reason: 'before_window' };
  if (Date.parse(offer.sale_end) < t) return { sellable: false, reason: 'after_window' };
  return { sellable: true };
}

export function validateQuantity(offer: Pick<TicketOffer, 'max_per_order'>, quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new DomainError('invalid_quantity', 'Quantity must be at least 1');
  }
  if (quantity > offer.max_per_order) {
    throw new DomainError('invalid_quantity', `Maximum ${offer.max_per_order} tickets per order`);
  }
  return quantity;
}

export const LOW_AVAILABILITY_THRESHOLD = 10;

/**
 * Derives the user-facing ticket status for a match from its offers and live availability.
 */
export function deriveMatchTicketStatus(
  matchStatus: 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled',
  offers: Pick<TicketOffer, 'status' | 'sale_start' | 'sale_end' | 'price_minor' | 'currency'>[],
  availableByOffer: number[],
  now: Date,
): { status: MatchTicketStatus; fromMinor?: number; currency?: Currency; available: number } {
  if (matchStatus === 'cancelled' || matchStatus === 'postponed') return { status: 'unavailable', available: 0 };
  if (!offers.length) return { status: 'unavailable', available: 0 };
  if (matchStatus === 'final' || matchStatus === 'live') return { status: 'sales_closed', available: 0 };
  let available = 0;
  let from: number | undefined;
  let currency: Currency | undefined;
  let anyBefore = false;
  let anyAfter = false;
  let anySellable = false;
  offers.forEach((o, i) => {
    const w = evaluateOfferWindow(o, now);
    if (w.reason === 'before_window') anyBefore = true;
    if (w.reason === 'after_window' || w.reason === 'closed') anyAfter = true;
    if (!w.sellable) return;
    anySellable = true;
    const n = Math.max(0, availableByOffer[i] ?? 0);
    available += n;
    if (n > 0 && (from == null || o.price_minor < from)) {
      from = o.price_minor;
      currency = o.currency;
    }
  });
  if (anySellable) {
    if (available === 0) return { status: 'sold_out', available: 0 };
    if (available <= LOW_AVAILABILITY_THRESHOLD) return { status: 'low_availability', fromMinor: from, currency, available };
    return { status: 'available', fromMinor: from, currency, available };
  }
  if (anyBefore) return { status: 'not_on_sale', available: 0 };
  if (anyAfter) return { status: 'sales_closed', available: 0 };
  return { status: 'unavailable', available: 0 };
}

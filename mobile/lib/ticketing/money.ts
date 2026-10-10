import { DomainError } from '../competition/states.ts';
import { CURRENCIES, type Currency, type Money } from './types.ts';

export function isCurrency(v: unknown): v is Currency {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, v);
}

export function assertCurrency(v: unknown): asserts v is Currency {
  if (!isCurrency(v)) throw new DomainError('unsupported_currency', `Unsupported currency: ${String(v)}`);
}

/** Minor-unit amounts must be safe non-negative integers. */
export function validateMinor(amount: unknown, field = 'amount'): number {
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
    throw new DomainError('invalid_money', `${field} must be a non-negative integer in minor units`);
  }
  return amount;
}

export function money(amountMinor: number, currency: Currency): Money {
  assertCurrency(currency);
  return { amountMinor: validateMinor(amountMinor), currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new DomainError('currency_mismatch', 'Cannot add different currencies');
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function multiplyMoney(a: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) throw new DomainError('invalid_quantity', 'Quantity must be a non-negative integer');
  return money(a.amountMinor * qty, a.currency);
}

export function formatMoney(amountMinor: number, currency: Currency, opts: { compact?: boolean } = {}): string {
  const def = CURRENCIES[currency] ?? CURRENCIES.USD;
  const major = amountMinor / 10 ** def.decimals;
  const num =
    def.decimals === 0
      ? Math.round(major).toLocaleString('en-US')
      : major.toLocaleString('en-US', { minimumFractionDigits: def.decimals, maximumFractionDigits: def.decimals });
  if (currency === 'USD') return `$${num}`;
  if (currency === 'EUR') return `€${num}`;
  return opts.compact ? `${num} ${def.symbol}` : `${def.symbol} ${num}`;
}

export function toMajor(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCIES[currency].decimals;
}

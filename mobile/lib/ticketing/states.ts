import { DomainError } from '../competition/states.ts';
import type { HoldState, OrderState, PaymentAttemptState, TicketState } from './types.ts';

const ORDER: Readonly<Record<OrderState, readonly OrderState[]>> = Object.freeze({
  awaiting_checkout: ['pending', 'cancelled', 'expired', 'paid'],
  pending: ['paid', 'failed', 'cancelled', 'expired'],
  // a failed/cancelled checkout may be retried while the hold is alive
  failed: ['pending', 'cancelled', 'expired', 'paid'],
  cancelled: [],
  expired: [],
  paid: ['cancellation_requested', 'refund_pending'],
  cancellation_requested: ['paid', 'refund_pending'],
  refund_pending: ['refunded', 'partially_refunded', 'refund_failed'],
  partially_refunded: ['refund_pending', 'refunded'],
  refunded: [],
  refund_failed: ['refund_pending'],
});

const HOLD: Readonly<Record<HoldState, readonly HoldState[]>> = Object.freeze({
  active: ['converted', 'released', 'expired'],
  converted: [],
  released: [],
  expired: [],
});

const ATTEMPT: Readonly<Record<PaymentAttemptState, readonly PaymentAttemptState[]>> = Object.freeze({
  created: ['redirected', 'pending', 'succeeded', 'failed', 'cancelled'],
  redirected: ['pending', 'succeeded', 'failed', 'cancelled'],
  pending: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
});

const TICKET: Readonly<Record<TicketState, readonly TicketState[]>> = Object.freeze({
  issuing: ['active', 'cancelled'],
  active: ['used', 'cancelled', 'refund_pending'],
  used: [],
  cancelled: [],
  refund_pending: ['refunded', 'active'],
  refunded: [],
});

function check<T extends string>(table: Readonly<Record<T, readonly T[]>>, kind: string, from: T, to: T) {
  if (from === to) return;
  if (!table[from]?.includes(to)) {
    throw new DomainError('invalid_transition', `${kind} cannot move from ${from} to ${to}`, 409);
  }
}

export const assertOrderTransition = (from: OrderState, to: OrderState) => check(ORDER, 'Order', from, to);
export const assertHoldTransition = (from: HoldState, to: HoldState) => check(HOLD, 'Hold', from, to);
export const assertAttemptTransition = (from: PaymentAttemptState, to: PaymentAttemptState) =>
  check(ATTEMPT, 'Payment attempt', from, to);
export const assertTicketTransition = (from: TicketState, to: TicketState) => check(TICKET, 'Ticket', from, to);

export const canOrderTransition = (from: OrderState, to: OrderState) => from === to || ORDER[from].includes(to);

export function isOrderTerminal(s: OrderState): boolean {
  return ORDER[s].length === 0;
}

export function isOrderPayable(s: OrderState): boolean {
  return s === 'awaiting_checkout' || s === 'failed';
}

export function isOrderPaidLike(s: OrderState): boolean {
  return ['paid', 'cancellation_requested', 'refund_pending', 'partially_refunded', 'refund_failed'].includes(s);
}

/**
 * Ticketing / order / payment domain contracts (Task 1).
 * Money is always integer minor units + ISO currency. Ownership uses Appwrite account IDs.
 */

export const CURRENCIES = {
  USD: { code: 'USD', decimals: 2, symbol: '$', name: 'US Dollar' },
  LBP: { code: 'LBP', decimals: 0, symbol: 'LBP', name: 'Lebanese Pound' },
  EUR: { code: 'EUR', decimals: 2, symbol: '€', name: 'Euro' },
} as const;
export type Currency = keyof typeof CURRENCIES;

export interface Money {
  amountMinor: number;
  currency: Currency;
}

export const OFFER_KINDS = ['ga', 'assigned'] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

export const OFFER_STATUSES = ['draft', 'on_sale', 'paused', 'sold_out', 'closed'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const HOLD_STATES = ['active', 'converted', 'released', 'expired'] as const;
export type HoldState = (typeof HOLD_STATES)[number];

export const ORDER_STATES = [
  'awaiting_checkout',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'cancellation_requested',
  'refund_pending',
  'partially_refunded',
  'refunded',
  'refund_failed',
] as const;
export type OrderState = (typeof ORDER_STATES)[number];

export const PAYMENT_ATTEMPT_STATES = ['created', 'redirected', 'pending', 'succeeded', 'failed', 'cancelled'] as const;
export type PaymentAttemptState = (typeof PAYMENT_ATTEMPT_STATES)[number];

export const TICKET_STATES = ['issuing', 'active', 'used', 'cancelled', 'refund_pending', 'refunded'] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const DELIVERY_STATES = ['queued', 'sent', 'failed', 'retry'] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const SEAT_KINDS = ['standard', 'accessible', 'companion'] as const;
export type SeatKind = (typeof SEAT_KINDS)[number];

/** Public, user-facing ticket availability for a match. */
export type MatchTicketStatus =
  | 'available'
  | 'low_availability'
  | 'not_on_sale'
  | 'sold_out'
  | 'sales_closed'
  | 'unavailable';

export interface VenueSection {
  id: string;
  venue_id: string;
  code: string;
  name: string;
  kind: OfferKind;
  capacity: number;
  rows: number;
  seats_per_row: number;
  /** JSON string: { x, y, w, h, shape?: 'rect'|'arc', side?: 'north'|'south'|'east'|'west' } in a 0..100 grid */
  geometry: string;
  accessible: boolean;
  sort: number;
}

export interface VenueSeat {
  id: string;
  venue_id: string;
  section_id: string;
  row_label: string;
  seat_number: number;
  kind: SeatKind;
  label: string;
}

export interface TicketOffer {
  id: string;
  match_id: string;
  section_id: string;
  name: string;
  kind: OfferKind;
  price_minor: number;
  fee_minor: number;
  currency: Currency;
  sale_start: string;
  sale_end: string;
  status: OfferStatus;
  max_per_order: number;
  capacity: number;
}

export interface TicketHold {
  id: string;
  user_id: string;
  match_id: string;
  offer_id: string;
  quantity: number;
  unit_keys: string[];
  state: HoldState;
  expires_at: string;
  unit_price_minor: number;
  fee_minor: number;
  currency: Currency;
  order_id?: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  match_id: string;
  hold_id: string;
  state: OrderState;
  subtotal_minor: number;
  fees_minor: number;
  total_minor: number;
  currency: Currency;
  idempotency_key: string;
  provider?: string;
  provider_ref?: string;
  purchaser_email?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
  note?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  offer_id: string;
  unit_key: string;
  description: string;
  section_name: string;
  seat_label?: string;
  unit_price_minor: number;
  fee_minor: number;
  currency: Currency;
}

export interface PaymentAttempt {
  id: string;
  order_id: string;
  provider: string;
  provider_ref?: string;
  state: PaymentAttemptState;
  amount_minor: number;
  currency: Currency;
  checkout_url?: string;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
}

export interface PaymentEvent {
  id: string;
  provider: string;
  provider_event_id: string;
  order_id?: string;
  type: string;
  payload_json: string;
  signature_valid: boolean;
  processed: boolean;
  result?: string;
  received_at: string;
}

export interface Ticket {
  id: string;
  order_id: string;
  user_id: string;
  match_id: string;
  offer_id: string;
  unit_key: string;
  section_name: string;
  seat_label?: string;
  state: TicketState;
  nonce: string;
  issued_at: string;
  used_at?: string;
}

export interface TicketDelivery {
  id: string;
  order_id: string;
  ticket_id?: string;
  channel: 'email';
  to: string;
  state: DeliveryState;
  attempts: number;
  last_error?: string;
  next_attempt_at?: string;
  sent_at?: string;
}

export interface TicketingSettings {
  checkout_enabled: boolean;
  provider: string;
  refunds_enabled: boolean;
  hold_ttl_seconds: number;
  currency: Currency;
}

/**
 * Provider-neutral payment boundary. No provider SDK is installed.
 * A live adapter must not be implemented until merchant country, settlement currency,
 * required payment methods and the provider are approved.
 */
import type { Currency } from '../../../../lib/ticketing/types.ts';

export type ProviderPaymentState = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'unknown';
export type ProviderRefundState = 'pending' | 'succeeded' | 'failed' | 'unknown';

export interface CheckoutRequest {
  orderId: string;
  attemptId: string;
  amountMinor: number;
  currency: Currency;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  providerRef: string;
  checkoutUrl: string;
}

export interface ProviderEvent {
  /** Provider-unique event id, used for idempotency. */
  id: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.cancelled' | 'payment.pending' | 'refund.succeeded' | 'refund.failed';
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  occurredAt: string;
  raw: unknown;
}

export interface VerifiedEvent {
  valid: boolean;
  event?: ProviderEvent;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly live: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  verifyEvent(rawBody: string, headers: Record<string, string>): Promise<VerifiedEvent>;
  fetchPaymentState(providerRef: string): Promise<{ state: ProviderPaymentState; amountMinor?: number; currency?: Currency }>;
  cancel(providerRef: string): Promise<{ state: ProviderPaymentState }>;
  initiateRefund(providerRef: string, amountMinor: number): Promise<{ refundRef: string; state: ProviderRefundState }>;
  refundStatus(refundRef: string): Promise<{ state: ProviderRefundState }>;
}

/** Used when no provider is approved: checkout is unavailable. */
export class NullProvider implements PaymentProvider {
  readonly id = 'none';
  readonly live = false;
  async createCheckout(): Promise<CheckoutSession> {
    throw Object.assign(new Error('Checkout is unavailable until a payment provider is approved'), {
      code: 'checkout_unavailable',
      status: 409,
    });
  }
  async verifyEvent(): Promise<VerifiedEvent> {
    return { valid: false, reason: 'no provider configured' };
  }
  async fetchPaymentState() {
    return { state: 'unknown' as const };
  }
  async cancel() {
    return { state: 'unknown' as const };
  }
  async initiateRefund(): Promise<{ refundRef: string; state: ProviderRefundState }> {
    throw Object.assign(new Error('Refunds are not enabled'), { code: 'refund_unavailable', status: 409 });
  }
  async refundStatus() {
    return { state: 'unknown' as const };
  }
}

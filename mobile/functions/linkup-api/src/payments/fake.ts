/**
 * Fake payment provider for automated tests and staging demos.
 * - Hosted checkout = an in-app test page (no card fields, no real money).
 * - Events are HMAC-signed with FAKE_PROVIDER_SECRET and carry a provider event id for idempotency.
 * - Provider-side state lives in a small store (the payment_attempts collection in production).
 */
import type { Currency } from '../../../../lib/ticketing/types.ts';
import { hmac, safeEqual } from '../context.ts';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  ProviderEvent,
  ProviderPaymentState,
  ProviderRefundState,
  VerifiedEvent,
} from './adapter.ts';

export interface FakeStateStore {
  getState(providerRef: string): Promise<{ state: ProviderPaymentState; amountMinor: number; currency: Currency } | null>;
  setState(providerRef: string, state: ProviderPaymentState): Promise<void>;
}

export interface FakeEventInput {
  id: string;
  type: ProviderEvent['type'];
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  occurredAt?: string;
}

export class FakeProvider implements PaymentProvider {
  readonly id = 'fake';
  readonly live = false;
  private readonly secret: string;
  readonly store: FakeStateStore;
  private readonly checkoutBaseUrl: string;
  constructor(secret: string, store: FakeStateStore, checkoutBaseUrl: string) {
    this.secret = secret;
    this.store = store;
    this.checkoutBaseUrl = checkoutBaseUrl;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const providerRef = `fake_${req.attemptId}`;
    await this.store.setState(providerRef, 'pending');
    const url = `${this.checkoutBaseUrl}/booking/${encodeURIComponent(req.orderId)}?checkout=fake&attempt=${encodeURIComponent(req.attemptId)}`;
    return { providerRef, checkoutUrl: url };
  }

  /** Builds a signed event body + headers exactly like the provider would post to the webhook. */
  signEvent(input: FakeEventInput): { body: string; headers: Record<string, string> } {
    const body = JSON.stringify({ ...input, occurredAt: input.occurredAt ?? new Date().toISOString() });
    return { body, headers: { 'x-fake-signature': hmac(this.secret, body) } };
  }

  async verifyEvent(rawBody: string, headers: Record<string, string>): Promise<VerifiedEvent> {
    const sig = headers['x-fake-signature'] || headers['X-Fake-Signature'];
    if (!sig || !safeEqual(sig, hmac(this.secret, rawBody))) return { valid: false, reason: 'invalid signature' };
    let parsed: FakeEventInput & { occurredAt: string };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: 'malformed body' };
    }
    if (!parsed.id || !parsed.type || !parsed.providerRef) return { valid: false, reason: 'missing fields' };
    return {
      valid: true,
      event: {
        id: parsed.id,
        type: parsed.type,
        providerRef: parsed.providerRef,
        amountMinor: Number(parsed.amountMinor),
        currency: parsed.currency,
        occurredAt: parsed.occurredAt,
        raw: parsed,
      },
    };
  }

  async fetchPaymentState(providerRef: string) {
    const s = await this.store.getState(providerRef);
    return s ? { state: s.state, amountMinor: s.amountMinor, currency: s.currency } : { state: 'unknown' as const };
  }

  async cancel(providerRef: string) {
    const s = await this.store.getState(providerRef);
    if (!s || s.state === 'pending') {
      await this.store.setState(providerRef, 'cancelled');
      return { state: 'cancelled' as const };
    }
    return { state: s.state };
  }

  async initiateRefund(providerRef: string): Promise<{ refundRef: string; state: ProviderRefundState }> {
    return { refundRef: `refund_${providerRef}`, state: 'pending' };
  }

  async refundStatus(): Promise<{ state: ProviderRefundState }> {
    return { state: 'pending' };
  }
}

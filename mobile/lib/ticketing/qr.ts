/**
 * Opaque ticket credential format. The credential never contains purchaser PII or order data.
 * Format: LKT1.<ticketId>.<nonce>.<signature>  (signature = HMAC-SHA256, server-only secret)
 */
export const CREDENTIAL_PREFIX = 'LKT1';

export interface ParsedCredential {
  ticketId: string;
  nonce: string;
  signature: string;
}

const PART = /^[A-Za-z0-9_-]+$/;

export function formatCredential(ticketId: string, nonce: string, signature: string): string {
  return [CREDENTIAL_PREFIX, ticketId, nonce, signature].join('.');
}

export function parseCredential(raw: unknown): ParsedCredential | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.trim().split('.');
  if (parts.length !== 4 || parts[0] !== CREDENTIAL_PREFIX) return null;
  const [, ticketId, nonce, signature] = parts;
  if (![ticketId, nonce, signature].every((p) => p.length > 0 && p.length <= 128 && PART.test(p))) return null;
  return { ticketId, nonce, signature };
}

/** Message that is signed; keeps the credential bound to ticket + nonce only. */
export function credentialMessage(ticketId: string, nonce: string): string {
  return `${CREDENTIAL_PREFIX}:${ticketId}:${nonce}`;
}

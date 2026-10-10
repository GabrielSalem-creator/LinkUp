import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { DomainError } from '../../../lib/competition/states.ts';
import type { Currency } from '../../../lib/ticketing/types.ts';
import type { Db, Doc } from './db.ts';
import type { EmailSender } from './email.ts';
import type { PaymentProvider } from './payments/adapter.ts';

export interface Settings {
  competition_enabled: boolean;
  checkout_enabled: boolean;
  refunds_enabled: boolean;
  provider: string;
  hold_ttl_seconds: number;
  currency: Currency;
}

export const DEFAULT_SETTINGS: Settings = {
  competition_enabled: true,
  checkout_enabled: false,
  refunds_enabled: false,
  provider: 'none',
  hold_ttl_seconds: 600,
  currency: 'USD',
};

export interface AppContext {
  db: Db;
  now: () => Date;
  isAdmin: (userId: string) => Promise<boolean>;
  lookupUser: (userId: string) => Promise<{ email?: string; name?: string } | null>;
  provider: PaymentProvider;
  email: EmailSender;
  secrets: { ticketSigning: string };
  log: (msg: string) => void;
  /** Payment window granted once checkout starts (seconds). */
  paymentWindowSeconds: number;
}

export interface RequestContext {
  userId: string | null;
  correlationId: string;
}

export const COL = {
  competitions: 'competitions',
  seasons: 'seasons',
  teams: 'competition_teams',
  players: 'players',
  teamPlayers: 'team_players',
  venues: 'venues',
  sections: 'venue_sections',
  seats: 'venue_seats',
  matches: 'matches',
  teamStats: 'match_team_stats',
  playerStats: 'match_player_stats',
  corrections: 'stat_corrections',
  media: 'team_media',
  standings: 'standings',
  leaderboards: 'leaderboard_entries',
  rankings: 'ranking_entries',
  offers: 'ticket_offers',
  locks: 'inventory_locks',
  holds: 'ticket_holds',
  orders: 'orders',
  orderItems: 'order_items',
  attempts: 'payment_attempts',
  events: 'payment_events',
  tickets: 'tickets',
  deliveries: 'ticket_deliveries',
  settings: 'app_settings',
} as const;

export async function loadSettings(db: Db): Promise<Settings> {
  const doc = await db.get(COL.settings, 'ticketing');
  if (!doc) return { ...DEFAULT_SETTINGS };
  return {
    competition_enabled: Boolean(doc.competition_enabled),
    checkout_enabled: Boolean(doc.checkout_enabled),
    refunds_enabled: Boolean(doc.refunds_enabled),
    provider: String(doc.provider || 'none'),
    hold_ttl_seconds: Number(doc.hold_ttl_seconds || 600),
    currency: (doc.currency as Currency) || 'USD',
  };
}

/* --------------------------------- helpers --------------------------------- */

export function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

/** Deterministic, Appwrite-safe document ID (<= 36 chars). */
export function detId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${sha1(parts.join(':')).slice(0, 30)}`;
}

export function randomId(prefix = ''): string {
  const r = randomBytes(12).toString('hex');
  return prefix ? `${prefix}_${r}`.slice(0, 36) : r.slice(0, 20);
}

export function hmac(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function requireUser(req: RequestContext): string {
  if (!req.userId) throw new DomainError('unauthenticated', 'Sign in to continue', 401);
  return req.userId;
}

export async function requireAdmin(ctx: AppContext, req: RequestContext): Promise<string> {
  const uid = requireUser(req);
  if (!(await ctx.isAdmin(uid))) throw new DomainError('forbidden', 'App admin membership required', 403);
  return uid;
}

export function userReadPermission(userId: string): string[] {
  return [`read("user:${userId}")`];
}

export function mustGet(doc: Doc | null, what: string): Doc {
  if (!doc) throw new DomainError('not_found', `${what} not found`, 404);
  return doc;
}

export function str(v: unknown, field: string, opts: { max?: number; optional?: boolean } = {}): string | undefined {
  if (v == null || v === '') {
    if (opts.optional) return undefined;
    throw new DomainError('invalid_input', `${field} is required`);
  }
  if (typeof v !== 'string') throw new DomainError('invalid_input', `${field} must be a string`);
  if (opts.max && v.length > opts.max) throw new DomainError('invalid_input', `${field} is too long`);
  return v;
}

export function int(v: unknown, field: string, opts: { optional?: boolean; min?: number; max?: number } = {}): number | undefined {
  if (v == null) {
    if (opts.optional) return undefined;
    throw new DomainError('invalid_input', `${field} is required`);
  }
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new DomainError('invalid_input', `${field} must be an integer`);
  if (opts.min != null && v < opts.min) throw new DomainError('invalid_input', `${field} must be >= ${opts.min}`);
  if (opts.max != null && v > opts.max) throw new DomainError('invalid_input', `${field} must be <= ${opts.max}`);
  return v;
}

export function pick<T extends object>(doc: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (doc[k] !== undefined) out[k] = doc[k];
  return out;
}

/** Strip Appwrite metadata and never leak purchaser/admin fields in public responses. */
export function publicDoc(doc: Doc): Record<string, unknown> {
  const { $permissions: _p, $databaseId: _d, $collectionId: _c, $sequence: _s, ...rest } = doc as Doc & {
    $permissions?: unknown;
    $databaseId?: unknown;
    $collectionId?: unknown;
    $sequence?: unknown;
  };
  return { ...rest, id: doc.$id };
}

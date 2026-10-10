import { COL, type AppContext } from '../functions/linkup-api/src/context.ts';
import { MemoryDb } from '../functions/linkup-api/src/db.ts';
import { ScriptedSender } from '../functions/linkup-api/src/email.ts';
import { FakeProvider, type FakeStateStore } from '../functions/linkup-api/src/payments/fake.ts';
import { NullProvider } from '../functions/linkup-api/src/payments/adapter.ts';
import { dispatch, type HttpRequest } from '../functions/linkup-api/src/router.ts';

export const FAKE_SECRET = 'test-fake-secret';
export const SIGNING_SECRET = 'test-signing-secret';

export class Harness {
  db = new MemoryDb();
  clock = new Date('2026-03-01T10:00:00.000Z');
  admins = new Set<string>(['admin1']);
  users = new Map<string, { email?: string; name?: string }>([
    ['admin1', { email: 'admin@linkup.app', name: 'Admin' }],
    ['alice', { email: 'alice@linkup.app', name: 'Alice' }],
    ['bob', { email: 'bob@linkup.app', name: 'Bob' }],
    ['guest', {}],
  ]);
  email = new ScriptedSender();
  fakeState = new Map<string, { state: 'pending' | 'succeeded' | 'failed' | 'cancelled'; amountMinor: number; currency: 'USD' }>();
  provider: FakeProvider | NullProvider;
  ctx: AppContext;

  constructor(opts: { provider?: 'fake' | 'none' } = {}) {
    const store: FakeStateStore = {
      getState: async (ref) => {
        const s = this.fakeState.get(ref);
        if (!s) return null;
        const a = (await this.db.list(COL.attempts, { where: [['provider_ref', 'eq', ref]], limit: 1 }))[0];
        return { state: s.state, amountMinor: a ? Number(a.amount_minor) : s.amountMinor, currency: (a ? String(a.currency) : 'USD') as 'USD' };
      },
      setState: async (ref, state) => {
        const cur = this.fakeState.get(ref);
        this.fakeState.set(ref, { state: state as never, amountMinor: cur?.amountMinor ?? 0, currency: 'USD' });
      },
    };
    this.provider = opts.provider === 'none' ? new NullProvider() : new FakeProvider(FAKE_SECRET, store, 'https://app.test');
    this.ctx = {
      db: this.db,
      now: () => new Date(this.clock),
      isAdmin: async (uid) => this.admins.has(uid),
      lookupUser: async (uid) => this.users.get(uid) ?? null,
      provider: this.provider,
      email: this.email,
      secrets: { ticketSigning: SIGNING_SECRET },
      log: () => {},
      paymentWindowSeconds: 900,
    };
  }

  advance(seconds: number) {
    this.clock = new Date(this.clock.getTime() + seconds * 1000);
  }

  async call(method: string, path: string, body?: unknown, userId?: string | null, extraHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extraHeaders };
    if (userId) headers['x-appwrite-user-id'] = userId;
    const [p, qs] = path.split('?');
    const query: Record<string, string> = {};
    if (qs) for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      query[k] = decodeURIComponent(v ?? '');
    }
    const http: HttpRequest = { method, path: p, headers, bodyText: body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body), query };
    return dispatch(this.ctx, http);
  }

  /** Seeds a football competition with two teams, a venue with GA + assigned sections, a match and offers. */
  async seedFootball() {
    const db = this.db;
    await db.create(COL.settings, 'ticketing', {
      competition_enabled: true,
      checkout_enabled: true,
      refunds_enabled: false,
      provider: 'fake',
      hold_ttl_seconds: 600,
      currency: 'USD',
    });
    await db.create(COL.competitions, 'cmp-lpl', { name: 'Lebanese Premier League', slug: 'lpl', sport: 'football', status: 'published', country: 'LB', sort: 1 });
    await db.create(COL.competitions, 'cmp-lbl', { name: 'Lebanese Basketball League', slug: 'lbl', sport: 'basketball', status: 'published', country: 'LB', sort: 2 });
    await db.create(COL.seasons, 'ssn-lpl', { competition_id: 'cmp-lpl', name: '2026/27', start_date: '2026-02-01', end_date: '2026-06-30', status: 'active', is_current: true, matchweeks: 22 });
    await db.create(COL.seasons, 'ssn-lbl', { competition_id: 'cmp-lbl', name: '2026/27', start_date: '2026-02-01', end_date: '2026-06-30', status: 'active', is_current: true, matchweeks: 22 });
    for (const [id, name, cmp] of [
      ['t-ansar', 'Al Ansar', 'cmp-lpl'],
      ['t-nejmeh', 'Nejmeh', 'cmp-lpl'],
      ['t-ahed', 'Al Ahed', 'cmp-lpl'],
      ['t-riyadi', 'Al Riyadi', 'cmp-lbl'],
    ] as const) {
      await db.create(COL.teams, id, { competition_id: cmp, name, short_name: name.slice(0, 3).toUpperCase(), primary_color: '#133440', secondary_color: '#5ABDB7' });
    }
    await db.create(COL.players, 'p-gk', { full_name: 'Mostafa Matar', nationality: 'LB', is_lebanese: true, position: 'GK' });
    await db.create(COL.players, 'p-fw', { full_name: 'Hassan Maatouk', nationality: 'LB', is_lebanese: true, position: 'FW' });
    await db.create(COL.players, 'p-foreign', { full_name: 'Foreign Striker', nationality: 'BR', is_lebanese: false, position: 'FW' });
    await db.create(COL.venues, 'v-cs', { name: 'Camille Chamoun Sports City', city: 'Beirut', capacity: 48000 });
    await db.create(COL.sections, 'sec-ga', { venue_id: 'v-cs', code: 'N', name: 'North Stand', kind: 'ga', capacity: 5, rows: 0, seats_per_row: 0, geometry: '{}', accessible: false, sort: 1 });
    await db.create(COL.sections, 'sec-vip', { venue_id: 'v-cs', code: 'VIP', name: 'VIP Tribune', kind: 'assigned', capacity: 4, rows: 2, seats_per_row: 2, geometry: '{}', accessible: true, sort: 0 });
    for (const [row, n, kind] of [
      ['A', 1, 'standard'],
      ['A', 2, 'accessible'],
      ['B', 1, 'standard'],
      ['B', 2, 'companion'],
    ] as const) {
      await db.create(COL.seats, `seat-${row}${n}`, { venue_id: 'v-cs', section_id: 'sec-vip', row_label: row, seat_number: n, kind, label: `${row}${n}` });
    }
    await db.create(COL.matches, 'm1', {
      competition_id: 'cmp-lpl',
      season_id: 'ssn-lpl',
      home_team_id: 't-ansar',
      away_team_id: 't-nejmeh',
      venue_id: 'v-cs',
      kickoff_at: '2026-03-10T18:00:00.000Z',
      matchweek: 5,
      status: 'scheduled',
      published: true,
      result_version: 0,
    });
    await db.create(COL.offers, 'off-ga', {
      match_id: 'm1',
      section_id: 'sec-ga',
      name: 'North Stand',
      kind: 'ga',
      price_minor: 1000,
      fee_minor: 100,
      currency: 'USD',
      sale_start: '2026-02-01T00:00:00.000Z',
      sale_end: '2026-03-10T17:00:00.000Z',
      status: 'on_sale',
      max_per_order: 4,
      capacity: 5,
    });
    await db.create(COL.offers, 'off-vip', {
      match_id: 'm1',
      section_id: 'sec-vip',
      name: 'VIP Tribune',
      kind: 'assigned',
      price_minor: 5000,
      fee_minor: 500,
      currency: 'USD',
      sale_start: '2026-02-01T00:00:00.000Z',
      sale_end: '2026-03-10T17:00:00.000Z',
      status: 'on_sale',
      max_per_order: 4,
      capacity: 4,
    });
  }

  /** hold -> order -> checkout -> returns { order, attempt } */
  async buyGa(user: string, quantity: number, idem = `idem-${user}-${Date.now()}-${Math.random()}`) {
    const hold = await this.call('POST', '/holds', { matchId: 'm1', offerId: 'off-ga', quantity }, user);
    if (hold.status !== 200) return { hold, order: null, checkout: null };
    const order = await this.call('POST', '/orders', { holdId: (hold.body as { id: string }).id, idempotencyKey: idem }, user);
    if (order.status !== 200) return { hold, order, checkout: null };
    const orderId = (order.body as { order: { id: string } }).order.id;
    const checkout = await this.call('POST', `/orders/${orderId}/checkout`, {}, user);
    return { hold, order, checkout, orderId, attemptId: (checkout.body as { attempt_id?: string }).attempt_id };
  }
}

/**
 * Path router. Every handler receives (ctx, req, params, body). Errors map to JSON { error, code }.
 */
import { DomainError } from '../../../lib/competition/states.ts';
import { createMatch, listCorrections, recalc, setMatchStats, setRankings, updateMatch, updateSettings } from './admin.ts';
import { COL, loadSettings, randomId, type AppContext, type RequestContext } from './context.ts';
import { runJobs } from './jobs.ts';
import { fakeComplete, handleWebhook, syncOrder } from './payments/service.ts';
import { cancelHold, cancelOrder, createHold, createOrder, getOrder, listMyTickets, listOrders, matchAvailability, startCheckout } from './ticketing.ts';
import { getTicket, retryDelivery, validateTicket } from './tickets.ts';

export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyText: string;
  query: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  body: unknown;
}

type Handler = (ctx: AppContext, req: RequestContext, params: Record<string, string>, body: Record<string, unknown>, http: HttpRequest) => Promise<unknown>;

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return '([^/]+)';
      }) +
      '/?$',
  );
  routes.push({ method, pattern, keys, handler });
}

route('GET', '/health', async () => ({ ok: true }));
route('GET', '/me', async (ctx, req) => ({
  user_id: req.userId,
  is_app_admin: req.userId ? await ctx.isAdmin(req.userId) : false,
}));
route('GET', '/config', async (ctx) => {
  const s = await loadSettings(ctx.db);
  return {
    competition_enabled: s.competition_enabled,
    checkout_enabled: s.checkout_enabled && ctx.provider.id !== 'none',
    provider: ctx.provider.id,
    test_mode: !ctx.provider.live,
    refunds_enabled: s.refunds_enabled,
    hold_ttl_seconds: s.hold_ttl_seconds,
    currency: s.currency,
    email_delivery: ctx.email.id,
  };
});

// admin
route('POST', '/admin/matches', (ctx, req, _p, body) => createMatch(ctx, req, body));
route('PATCH', '/admin/matches/:id', (ctx, req, p, body) => updateMatch(ctx, req, p.id, body));
route('PUT', '/admin/matches/:id/stats', (ctx, req, p, body) => setMatchStats(ctx, req, p.id, body));
route('PUT', '/admin/rankings', (ctx, req, _p, body) => setRankings(ctx, req, body));
route('PATCH', '/admin/settings', (ctx, req, _p, body) => updateSettings(ctx, req, body));
route('GET', '/admin/corrections', (ctx, req, _p, _b, http) => listCorrections(ctx, req, http.query.match_id));
route('POST', '/admin/seasons/:id/recalculate', (ctx, req, p) => recalc(ctx, req, p.id));
route('POST', '/admin/jobs/run', async (ctx, req) => {
  if (!req.userId || !(await ctx.isAdmin(req.userId))) throw new DomainError('forbidden', 'App admin membership required', 403);
  return runJobs(ctx);
});
route('GET', '/admin/orders/:id', (ctx, req, p) => getOrder(ctx, req, p.id));

// ticketing
route('GET', '/matches/:id/availability', (ctx, req, p) => matchAvailability(ctx, req, p.id));
route('POST', '/holds', (ctx, req, _p, body) => createHold(ctx, req, body));
route('DELETE', '/holds/:id', (ctx, req, p) => cancelHold(ctx, req, p.id));
route('POST', '/orders', (ctx, req, _p, body) => createOrder(ctx, req, body));
route('GET', '/orders', (ctx, req) => listOrders(ctx, req));
route('GET', '/orders/:id', (ctx, req, p) => getOrder(ctx, req, p.id));
route('POST', '/orders/:id/checkout', (ctx, req, p, body) => startCheckout(ctx, req, p.id, body));
route('POST', '/orders/:id/cancel', (ctx, req, p) => cancelOrder(ctx, req, p.id));
route('POST', '/orders/:id/sync', (ctx, req, p) => syncOrder(ctx, req, p.id));
route('POST', '/payments/fake/complete', (ctx, req, _p, body) => fakeComplete(ctx, req, body));
route('GET', '/tickets', (ctx, req) => listMyTickets(ctx, req));
route('GET', '/tickets/:id', (ctx, req, p) => getTicket(ctx, req, p.id));
route('POST', '/tickets/validate', (ctx, req, _p, body) => validateTicket(ctx, req, body));
route('POST', '/deliveries/:id/retry', (ctx, req, p) => retryDelivery(ctx, req, p.id));

export async function dispatch(ctx: AppContext, http: HttpRequest): Promise<HttpResponse> {
  const correlationId = http.headers['x-correlation-id'] || randomId('rq');
  const userId = http.headers['x-appwrite-user-id'] || null;
  const req: RequestContext = { userId, correlationId };
  const path = http.path.startsWith('/') ? http.path : `/${http.path}`;
  try {
    if (http.method === 'POST' && /^\/payments\/webhook\/?$/.test(path)) {
      const r = await handleWebhook(ctx, http.bodyText, http.headers);
      return { status: r.status, body: r.body };
    }
    if (http.headers['x-appwrite-trigger'] === 'schedule') {
      return { status: 200, body: await runJobs(ctx) };
    }
    for (const r of routes) {
      if (r.method !== http.method) continue;
      const m = r.pattern.exec(path);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      let body: Record<string, unknown> = {};
      if (http.bodyText) {
        try {
          body = JSON.parse(http.bodyText);
        } catch {
          throw new DomainError('invalid_json', 'Body must be JSON');
        }
      }
      const result = await r.handler(ctx, req, params, body ?? {}, http);
      return { status: 200, body: result };
    }
    return { status: 404, body: { error: `No route ${http.method} ${path}`, code: 'no_route' } };
  } catch (e) {
    if (e instanceof DomainError) return { status: e.status, body: { error: e.message, code: e.code, correlation_id: correlationId } };
    const err = e as { message?: string; code?: unknown; status?: number };
    if (typeof err.code === 'string' && typeof err.status === 'number') {
      return { status: err.status, body: { error: err.message, code: err.code, correlation_id: correlationId } };
    }
    ctx.log(`unhandled ${correlationId}: ${err.message}`);
    return { status: 500, body: { error: 'Internal error', code: 'internal', correlation_id: correlationId } };
  }
}

export { COL };

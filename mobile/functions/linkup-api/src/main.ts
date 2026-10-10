/**
 * Appwrite Function entrypoint (Node runtime, open-runtimes v5 signature).
 * Privileged writes use the function's dynamic API key (x-appwrite-key), scoped in the function settings.
 */
import { Client, ID, Messaging } from 'node-appwrite';

import { AppwriteDb, makeAdminChecker, makeUserLookup } from './appwriteDb.ts';
import { COL, type AppContext } from './context.ts';
import { AppwriteMessagingSender, QueueOnlySender, type EmailSender } from './email.ts';
import { NullProvider, type PaymentProvider } from './payments/adapter.ts';
import { FakeProvider, type FakeStateStore } from './payments/fake.ts';
import { dispatch, type HttpRequest } from './router.ts';

type AwReq = {
  method: string;
  path: string;
  headers: Record<string, string>;
  bodyText?: string;
  bodyRaw?: string;
  body?: unknown;
  query: Record<string, string>;
};
type AwRes = { json: (body: unknown, status?: number, headers?: Record<string, string>) => unknown };
type AwContext = { req: AwReq; res: AwRes; log: (m: unknown) => void; error: (m: unknown) => void };

const APP_ADMINS_TEAM = process.env.APP_ADMINS_TEAM_ID || 'app-admins';

function buildContext(c: AwContext): AppContext {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
  const key = c.req.headers['x-appwrite-key'] || process.env.APPWRITE_API_KEY || '';
  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  const databaseId = process.env.APPWRITE_DATABASE_ID || 'linkup';
  const db = new AppwriteDb(client, databaseId);

  const fakeStore: FakeStateStore = {
    async getState(providerRef) {
      const rows = await db.list(COL.attempts, { where: [['provider_ref', 'eq', providerRef]], limit: 1 });
      const a = rows[0];
      if (!a) return null;
      const map: Record<string, 'pending' | 'succeeded' | 'failed' | 'cancelled'> = {
        created: 'pending',
        redirected: 'pending',
        pending: 'pending',
        succeeded: 'succeeded',
        failed: 'failed',
        cancelled: 'cancelled',
      };
      const override = a.failure_reason && String(a.failure_reason).startsWith('provider:') ? String(a.failure_reason).slice(9) : null;
      return { state: (override as never) || map[String(a.state)] || 'unknown', amountMinor: Number(a.amount_minor), currency: a.currency as never };
    },
    async setState(providerRef, state) {
      const rows = await db.list(COL.attempts, { where: [['provider_ref', 'eq', providerRef]], limit: 1 });
      if (rows[0]) await db.update(COL.attempts, rows[0].$id, { failure_reason: `provider:${state}` });
    },
  };

  let provider: PaymentProvider = new NullProvider();
  if ((process.env.PAYMENT_PROVIDER || 'none') === 'fake' && process.env.FAKE_PROVIDER_SECRET) {
    provider = new FakeProvider(process.env.FAKE_PROVIDER_SECRET, fakeStore, process.env.APP_PUBLIC_URL || 'https://linkup-gold-gamma.vercel.app');
  }

  let email: EmailSender = new QueueOnlySender();
  if (process.env.EMAIL_PROVIDER === 'appwrite') {
    const messaging = new Messaging(client);
    email = new AppwriteMessagingSender(async (msg) => {
      await messaging.createEmail({ messageId: ID.unique(), subject: msg.subject, content: msg.html, users: [msg.userId], html: true });
    });
  }

  return {
    db,
    now: () => new Date(),
    isAdmin: makeAdminChecker(client, APP_ADMINS_TEAM),
    lookupUser: makeUserLookup(client),
    provider,
    email,
    secrets: { ticketSigning: process.env.TICKET_SIGNING_SECRET || '' },
    log: (m) => c.log(m),
    paymentWindowSeconds: Number(process.env.PAYMENT_WINDOW_SECONDS || 900),
  };
}

export default async (c: AwContext) => {
  const ctx = buildContext(c);
  if (!ctx.secrets.ticketSigning) c.error('TICKET_SIGNING_SECRET is not set');
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.headers || {})) headers[k.toLowerCase()] = String(v);
  const bodyText = typeof c.req.bodyText === 'string' ? c.req.bodyText : typeof c.req.bodyRaw === 'string' ? c.req.bodyRaw : c.req.body ? JSON.stringify(c.req.body) : '';
  const http: HttpRequest = {
    method: String(c.req.method || 'GET').toUpperCase(),
    path: c.req.path || '/',
    headers,
    bodyText,
    query: c.req.query || {},
  };
  const res = await dispatch(ctx, http);
  return c.res.json(res.body, res.status);
};

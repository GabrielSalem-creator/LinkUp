import { config } from '@/lib/config';
import {
  account,
  clearPersistedSession,
  restorePersistedSession,
  saveFallbackCookies,
} from '@/lib/appwrite';

export const DEMO_EMAIL = 'demo@linkup.app';
export const DEMO_PASSWORD = 'LinkUpDemo123!';

type SessionPayload = {
  secret?: string;
  userId?: string;
  message?: string;
};

async function postSession(path: string, body?: Record<string, string>) {
  await clearPersistedSession();

  const res = await fetch(`${config.appwriteEndpoint}${path}`, {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': config.appwriteProjectId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as SessionPayload;
  if (!res.ok) {
    throw new Error(data.message || `Auth failed (${res.status})`);
  }

  const fallback = res.headers.get('x-fallback-cookies');
  if (!fallback) {
    // Official SDK path as backup (stores cookieFallback itself on web)
    throw new Error('Appwrite did not return X-Fallback-Cookies');
  }
  await saveFallbackCookies(fallback);
  return data;
}

export async function createEmailSessionRest(email: string, password: string) {
  return postSession('/account/sessions/email', { email, password });
}

export async function createDemoSessionRest() {
  // Prefer official SDK on web — it auto-saves cookieFallback from response headers
  try {
    await clearPersistedSession();
    await account.createEmailPasswordSession({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    return { userId: 'demoathlete001' };
  } catch {
    // REST + manual fallback cookie (works everywhere fetch can read the header)
    return createEmailSessionRest(DEMO_EMAIL, DEMO_PASSWORD);
  }
}

export async function createAnonymousSessionRest() {
  return postSession('/account/sessions/anonymous');
}

export async function getAccountSafe() {
  await restorePersistedSession();
  return account.get();
}

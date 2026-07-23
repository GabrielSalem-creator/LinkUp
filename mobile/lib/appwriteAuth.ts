import { config } from '@/lib/config';
import { account, clearPersistedSession, persistSession, restorePersistedSession } from '@/lib/appwrite';

type SessionPayload = {
  secret?: string;
  userId?: string;
  $id?: string;
};

async function postSession(path: string, body?: Record<string, string>): Promise<SessionPayload> {
  const res = await fetch(`${config.appwriteEndpoint}${path}`, {
    method: 'POST',
    headers: {
      'X-Appwrite-Project': config.appwriteProjectId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as SessionPayload & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || `Auth failed (${res.status})`);
  }
  if (data.secret) {
    await persistSession(data.secret);
  }
  return data;
}

export async function createAnonymousSessionRest() {
  await clearPersistedSession();
  return postSession('/account/sessions/anonymous');
}

export async function createEmailSessionRest(email: string, password: string) {
  await clearPersistedSession();
  return postSession('/account/sessions/email', { email, password });
}

export async function getAccountSafe() {
  await restorePersistedSession();
  return account.get();
}

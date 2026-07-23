import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from 'appwrite';
import { Platform } from 'react-native';

import { config } from '@/lib/config';

const FALLBACK_KEY = 'cookieFallback';

export const client = new Client()
  .setEndpoint(config.appwriteEndpoint)
  .setProject(config.appwriteProjectId);

// Ensure every request sends Appwrite's cookie-fallback header (needed when
// third-party cookies are blocked — localhost, Vercel, etc.)
const originalCall = client.call.bind(client) as typeof client.call;
(client as { call: typeof client.call }).call = (async (
  method: string,
  url: URL,
  headers: Record<string, string> = {},
  params?: unknown,
  responseType?: unknown
) => {
  try {
    let fallback: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      fallback = localStorage.getItem(FALLBACK_KEY);
    } else {
      fallback = await AsyncStorage.getItem(FALLBACK_KEY);
    }
    if (fallback) {
      headers = { ...headers, 'X-Fallback-Cookies': fallback };
    }
  } catch {
    /* ignore */
  }
  return originalCall(method, url, headers, params as never, responseType as never);
}) as typeof client.call;

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export { ID, Permission, Query, Role };

export const dbId = config.appwriteDatabaseId;

export const COLLECTION = {
  profiles: 'profiles',
  clubs: 'clubs',
  club_events: 'club_events',
  club_memberships: 'club_memberships',
  activities: 'activities',
  leagues: 'leagues',
  league_participants: 'league_participants',
  event_participants: 'event_participants',
  friendships: 'friendships',
  memories: 'memories',
  merch: 'merch',
  posts: 'posts',
} as const;

export type CollectionKey = keyof typeof COLLECTION;

export async function saveFallbackCookies(value: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(FALLBACK_KEY, value);
  }
  await AsyncStorage.setItem(FALLBACK_KEY, value);
}

export async function clearPersistedSession() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(FALLBACK_KEY);
    }
    await AsyncStorage.removeItem(FALLBACK_KEY);
    await AsyncStorage.removeItem('linkup_appwrite_session');
  } catch {
    /* ignore */
  }
  client.setSession('');
}

/** Kept for compatibility — prefer fallback cookies. */
export async function persistSession(secret: string | undefined | null) {
  if (!secret) return;
  client.setSession(secret);
  await AsyncStorage.setItem('linkup_appwrite_session', secret);
}

export async function restorePersistedSession(): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      if (localStorage.getItem(FALLBACK_KEY)) return true;
    }
    const fb = await AsyncStorage.getItem(FALLBACK_KEY);
    if (fb) {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(FALLBACK_KEY, fb);
      }
      return true;
    }
    const secret = await AsyncStorage.getItem('linkup_appwrite_session');
    if (secret) {
      client.setSession(secret);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

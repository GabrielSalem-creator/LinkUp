import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Account, Databases, Query } from 'appwrite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const endpoint = env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const project = env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;

// Simulate browser localStorage for Appwrite SDK cookie fallback
const store = new Map();
globalThis.window = {
  console,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const client = new Client().setEndpoint(endpoint).setProject(project);
const account = new Account(client);
const databases = new Databases(client);

await account.createEmailPasswordSession({
  email: 'demo@linkup.app',
  password: 'LinkUpDemo123!',
});
console.log('cookieFallback set?', Boolean(store.get('cookieFallback')));

const me = await account.get();
console.log('account', me.email, me.name);

const clubs = await databases.listDocuments({
  databaseId: 'linkup',
  collectionId: 'clubs',
  queries: [Query.limit(10)],
});
console.log('clubs', clubs.total, clubs.documents.map((d) => d.name).join(' | '));

const events = await databases.listDocuments({
  databaseId: 'linkup',
  collectionId: 'club_events',
  queries: [Query.limit(10)],
});
console.log('events', events.total);

const memberships = await databases.listDocuments({
  databaseId: 'linkup',
  collectionId: 'club_memberships',
  queries: [Query.equal('user_email', 'demo@linkup.app')],
});
console.log('memberships', memberships.total);

console.log('LIVE LINK OK');

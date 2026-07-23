import { readFileSync } from 'node:fs';
import { Client, Account, Databases, Query } from 'appwrite';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const client = new Client()
  .setEndpoint(env.EXPO_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(env.EXPO_PUBLIC_APPWRITE_PROJECT_ID);
const account = new Account(client);
const databases = new Databases(client);

const session = await account.createAnonymousSession();
console.log('session secret?', Boolean(session.secret), 'user', session.userId);
client.setSession(session.secret);
const me = await account.get();
console.log('me ok', me.$id);
const clubs = await databases.listDocuments({
  databaseId: 'linkup',
  collectionId: 'clubs',
  queries: [Query.limit(5)],
});
console.log(
  'clubs',
  clubs.total,
  clubs.documents.map((d) => d.name).join(', ')
);
const events = await databases.listDocuments({
  databaseId: 'linkup',
  collectionId: 'club_events',
  queries: [Query.limit(5)],
});
console.log('events', events.total);
console.log('OK');

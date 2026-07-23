/**
 * End-to-end Appwrite write checks: register → join club/event → create event → follow → logout.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Account, Databases, ID, Query } from 'appwrite';

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

const store = new Map();
globalThis.window = {
  console,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const endpoint = env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const project = env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const DB = env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'linkup';

const client = new Client().setEndpoint(endpoint).setProject(project);
const account = new Account(client);
const databases = new Databases(client);

const stamp = Date.now();
const email = `athlete.${stamp}@linkup.test`;
const password = 'LinkUpTest123!';
const name = `Athlete ${stamp % 10000}`;

function ok(label) {
  console.log(`✓ ${label}`);
}

try {
  await account.create({ userId: ID.unique(), email, password, name });
  ok(`register ${email}`);

  await account.createEmailPasswordSession({ email, password });
  const me = await account.get();
  ok(`login ${me.email}`);

  await databases.createDocument({
    databaseId: DB,
    collectionId: 'profiles',
    documentId: me.$id,
    data: {
      email,
      full_name: name,
      city: 'Beirut',
      total_distance_km: 0,
      total_activities: 0,
      current_streak: 0,
      longest_streak: 0,
    },
  });
  ok('profile create');

  const clubs = await databases.listDocuments({
    databaseId: DB,
    collectionId: 'clubs',
    queries: [Query.limit(1)],
  });
  const club = clubs.documents[0];
  if (!club) throw new Error('No clubs seeded');

  await databases.createDocument({
    databaseId: DB,
    collectionId: 'club_memberships',
    documentId: ID.unique(),
    data: { club_id: club.$id, user_email: email, status: 'active' },
  });
  ok(`join club ${club.name}`);

  const events = await databases.listDocuments({
    databaseId: DB,
    collectionId: 'club_events',
    queries: [Query.equal('club_id', club.$id), Query.limit(1)],
  });
  const event = events.documents[0];
  if (event) {
    await databases.createDocument({
      databaseId: DB,
      collectionId: 'event_participants',
      documentId: ID.unique(),
      data: {
        event_id: event.$id,
        user_email: email,
        event_date: event.date,
        event_title: event.title,
        club_name: club.name,
        confirmed: false,
      },
    });
    ok(`join event ${event.title}`);
  }

  const createdEvent = await databases.createDocument({
    databaseId: DB,
    collectionId: 'club_events',
    documentId: ID.unique(),
    data: {
      club_id: club.$id,
      club_name: club.name,
      title: `Test Session ${stamp % 1000}`,
      sport: club.sport || 'running',
      date: '2026-08-01',
      time: '07:00',
      meeting_point: 'TBD',
    },
  });
  ok(`create event ${createdEvent.title}`);

  await databases.createDocument({
    databaseId: DB,
    collectionId: 'friendships',
    documentId: ID.unique(),
    data: {
      requester_email: email,
      addressee_email: 'demo@linkup.app',
      status: 'pending',
      requester_name: name,
    },
  });
  ok('follow request → demo@linkup.app');

  await account.deleteSession({ sessionId: 'current' });
  store.clear();
  ok('logout');

  console.log('WRITE FLOWS OK');
} catch (e) {
  console.error('WRITE FLOW FAILED', e);
  process.exit(1);
}

/**
 * Creates a stable demo account + memberships so the app can always log in live.
 * demo@linkup.app / LinkUpDemo123!
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Databases, ID, Permission, Role, Query, Users } from 'node-appwrite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const DB = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'linkup';
const KEY = process.env.APPWRITE_API_KEY;

const EMAIL = 'demo@linkup.app';
const PASS = 'LinkUpDemo123!';
const NAME = 'Demo Athlete';
const USER_ID = 'demoathlete001';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
const users = new Users(client);
const db = new Databases(client);
const perms = [Permission.read(Role.any()), Permission.update(Role.users()), Permission.delete(Role.users())];

async function main() {
  try {
    await users.get(USER_ID);
    console.log('Demo user exists', USER_ID);
    try {
      await users.updatePassword(USER_ID, PASS);
      console.log('Password refreshed');
    } catch {
      /* ok */
    }
  } catch {
    await users.create(USER_ID, EMAIL, undefined, PASS, NAME);
    console.log('Created demo user', EMAIL);
  }

  try {
    await db.getDocument(DB, 'profiles', USER_ID);
    console.log('Profile exists');
  } catch {
    await db.createDocument(
      DB,
      'profiles',
      USER_ID,
      {
        email: EMAIL,
        full_name: NAME,
        city: 'Beirut',
        bio: 'Live Appwrite demo athlete',
        total_distance_km: 312.4,
        total_activities: 48,
        current_streak: 5,
        longest_streak: 12,
      },
      perms
    );
    console.log('Created profile');
  }

  for (const clubId of ['club-1', 'club-3', 'club-5']) {
    const existing = await db.listDocuments(DB, 'club_memberships', [
      Query.equal('club_id', clubId),
      Query.equal('user_email', EMAIL),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      console.log('Membership ok', clubId);
      continue;
    }
    await db.createDocument(
      DB,
      'club_memberships',
      ID.unique(),
      { club_id: clubId, user_email: EMAIL, status: 'active' },
      perms
    );
    console.log('Joined', clubId);
  }

  // league participant
  const lp = await db.listDocuments(DB, 'league_participants', [
    Query.equal('league_id', 'lg-1'),
    Query.equal('user_email', EMAIL),
    Query.limit(1),
  ]);
  if (lp.total === 0) {
    await db.createDocument(
      DB,
      'league_participants',
      ID.unique(),
      { league_id: 'lg-1', user_email: EMAIL, user_name: NAME },
      perms
    );
    console.log('Joined league lg-1');
  }

  // event RSVPs
  for (const [eventId, title, club] of [
    ['ev-1', 'Corniche Sunrise 10K', 'Run Club Beirut'],
    ['ev-3', 'Coastal Tempo Night', 'Run Club Jounieh'],
  ]) {
    const ep = await db.listDocuments(DB, 'event_participants', [
      Query.equal('event_id', eventId),
      Query.equal('user_email', EMAIL),
      Query.limit(1),
    ]);
    if (ep.total > 0) continue;
    await db.createDocument(
      DB,
      'event_participants',
      ID.unique(),
      {
        event_id: eventId,
        user_email: EMAIL,
        event_date: new Date().toISOString().slice(0, 10),
        event_title: title,
        club_name: club,
        confirmed: false,
      },
      perms
    );
    console.log('RSVP', eventId);
  }

  console.log('\nDemo login: demo@linkup.app / LinkUpDemo123!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

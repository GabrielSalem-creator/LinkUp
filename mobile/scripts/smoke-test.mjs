/**
 * End-to-end smoke test against live Appwrite (same flows the app uses).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Account, Databases, ID, Query } from 'node-appwrite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) throw new Error('Missing .env');
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

const results = [];
const ok = (name, detail = '') => {
  results.push({ name, pass: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, err) => {
  const detail = err?.message || String(err);
  results.push({ name, pass: false, detail });
  console.log(`❌ ${name} — ${detail}`);
};

async function main() {
  console.log(`Smoke test → ${ENDPOINT} / ${PROJECT}\n`);

  // Server key checks (data already seeded)
  const admin = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY);
  const db = new Databases(admin);

  try {
    const clubs = await db.listDocuments(DB, 'clubs', [Query.limit(100)]);
    if (clubs.total < 1) throw new Error('No clubs');
    ok('Clubs collection', `${clubs.total} clubs (e.g. ${clubs.documents[0].name})`);
  } catch (e) {
    fail('Clubs collection', e);
  }

  try {
    const events = await db.listDocuments(DB, 'club_events', [Query.orderAsc('date'), Query.limit(100)]);
    if (events.total < 1) throw new Error('No events');
    ok('Events collection', `${events.total} events`);
  } catch (e) {
    fail('Events collection', e);
  }

  try {
    const leagues = await db.listDocuments(DB, 'leagues', [
      Query.equal('invite_code', 'BEIRUT26'),
      Query.limit(1),
    ]);
    if (!leagues.documents[0]) throw new Error('BEIRUT26 missing');
    ok('League invite BEIRUT26', leagues.documents[0].name);
  } catch (e) {
    fail('League invite BEIRUT26', e);
  }

  try {
    const club = await db.getDocument(DB, 'clubs', 'club-1');
    if (club.club_password !== 'demo1234') throw new Error('Wrong portal password');
    ok('Club portal password', 'demo1234 matches club-1');
  } catch (e) {
    fail('Club portal password', e);
  }

  // Client-style auth using Users API to create a test user, then Account session via email
  // Anonymous sessions require client SDK without API key — use Users.create + session create with email
  const { Users } = await import('node-appwrite');
  const users = new Users(admin);
  const email = `smoke_${Date.now()}@linkup.test`;
  const password = 'TestPass123!';
  const name = 'Smoke Tester';
  let userId;

  try {
    const user = await users.create(ID.unique(), email, undefined, password, name);
    userId = user.$id;
    ok('Create test user', email);
  } catch (e) {
    fail('Create test user', e);
  }

  // Profile document (same as app ensureProfile)
  if (userId) {
    try {
      await db.createDocument(DB, 'profiles', userId, {
        email,
        full_name: name,
        city: 'Beirut',
        total_distance_km: 0,
        total_activities: 0,
        current_streak: 0,
        longest_streak: 0,
      });
      ok('Create profile document', userId);
    } catch (e) {
      fail('Create profile document', e);
    }

    try {
      const membership = await db.createDocument(DB, 'club_memberships', ID.unique(), {
        club_id: 'club-1',
        user_email: email,
        status: 'active',
      });
      ok('Join club (membership)', membership.$id);
    } catch (e) {
      fail('Join club (membership)', e);
    }

    try {
      await db.createDocument(DB, 'league_participants', ID.unique(), {
        league_id: 'lg-1',
        user_email: email,
        user_name: name,
      });
      ok('Join league BEIRUT26', 'participant added');
    } catch (e) {
      fail('Join league BEIRUT26', e);
    }

    try {
      await db.createDocument(DB, 'event_participants', ID.unique(), {
        event_id: 'ev-1',
        user_email: email,
        event_date: new Date().toISOString().slice(0, 10),
        event_title: 'Corniche Sunrise 10K',
        club_name: 'Run Club Beirut',
        confirmed: false,
      });
      ok('RSVP event', 'ev-1');
    } catch (e) {
      fail('RSVP event', e);
    }

    try {
      const mine = await db.listDocuments(DB, 'club_memberships', [
        Query.equal('user_email', email),
        Query.equal('status', 'active'),
      ]);
      if (mine.total < 1) throw new Error('membership not found');
      ok('Query my clubs', `${mine.total} membership(s)`);
    } catch (e) {
      fail('Query my clubs', e);
    }

    // cleanup test user
    try {
      await users.delete(userId);
      ok('Cleanup test user', 'deleted');
    } catch (e) {
      fail('Cleanup test user', e);
    }
  }

  // Public/client read without auth key — simulate browser list with guest permissions (Role.any read)
  try {
    const publicClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    // Without session, listDocuments as guest via REST
    const res = await fetch(
      `${ENDPOINT}/databases/${DB}/collections/clubs/documents?queries[]=${encodeURIComponent(JSON.stringify({ method: 'limit', values: [5] }))}`,
      {
        headers: {
          'X-Appwrite-Project': PROJECT,
          'Content-Type': 'application/json',
        },
      }
    );
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || res.statusText);
    ok('Public guest read clubs', `${body.total ?? body.documents?.length} via REST`);
  } catch (e) {
    fail('Public guest read clubs', e);
  }

  // Anonymous session (client Account without API key)
  try {
    const anonClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    // Use REST for anonymous session
    const res = await fetch(`${ENDPOINT}/account/sessions/anonymous`, {
      method: 'POST',
      headers: {
        'X-Appwrite-Project': PROJECT,
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || res.statusText);
    ok('Anonymous session', `user ${body.userId}`);
  } catch (e) {
    fail('Anonymous session', e);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n——— Summary: ${passed} passed, ${failed} failed ———`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

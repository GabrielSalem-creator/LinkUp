/**
 * Creates LinkUp database + all collections/attributes in Appwrite.
 *
 * Usage:
 *   1. Copy .env.example → .env
 *   2. Paste APPWRITE_API_KEY from Appwrite Console → Overview → Integrations → API Keys
 *      (scopes: databases.read, databases.write)
 *   3. node scripts/setup-appwrite.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Databases, Permission, Role } from 'node-appwrite';

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

const ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const PROJECT = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '6a61202f000e451a56a8';
const DB_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'linkup';
const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error('Missing APPWRITE_API_KEY in mobile/.env');
  console.error('Create one in Appwrite Console → Overview → Integrations → API Keys');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const databases = new Databases(client);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitAttr(collectionId, key) {
  for (let i = 0; i < 40; i++) {
    const attrs = await databases.listAttributes(DB_ID, collectionId);
    const found = attrs.attributes.find((a) => a.key === key);
    if (found?.status === 'available') return;
    if (found?.status === 'failed') throw new Error(`Attribute ${collectionId}.${key} failed`);
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${collectionId}.${key}`);
}

async function ensureDb() {
  try {
    await databases.get(DB_ID);
    console.log(`Database "${DB_ID}" exists`);
  } catch {
    await databases.create(DB_ID, 'LinkUp');
    console.log(`Created database "${DB_ID}"`);
  }
}

async function ensureCollection(id, name) {
  const perms = [
    Permission.read(Role.any()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users()),
  ];
  try {
    await databases.getCollection(DB_ID, id);
    console.log(`  collection ${id} exists`);
  } catch {
    await databases.createCollection(DB_ID, id, name, perms, false, true);
    console.log(`  created collection ${id}`);
  }
}

async function str(col, key, size = 255, required = false) {
  try {
    await databases.createStringAttribute(DB_ID, col, key, size, required);
    await waitAttr(col, key);
    console.log(`    + ${col}.${key} (string)`);
  } catch (e) {
    if (String(e.message || e).includes('already exists')) return;
    throw e;
  }
}

async function int(col, key, required = false, min = 0, max = 999999) {
  try {
    await databases.createIntegerAttribute(DB_ID, col, key, required, min, max);
    await waitAttr(col, key);
    console.log(`    + ${col}.${key} (integer)`);
  } catch (e) {
    if (String(e.message || e).includes('already exists')) return;
    throw e;
  }
}

async function float(col, key, required = false) {
  try {
    await databases.createFloatAttribute(DB_ID, col, key, required);
    await waitAttr(col, key);
    console.log(`    + ${col}.${key} (float)`);
  } catch (e) {
    if (String(e.message || e).includes('already exists')) return;
    throw e;
  }
}

async function bool(col, key, required = false) {
  try {
    await databases.createBooleanAttribute(DB_ID, col, key, required);
    await waitAttr(col, key);
    console.log(`    + ${col}.${key} (boolean)`);
  } catch (e) {
    if (String(e.message || e).includes('already exists')) return;
    throw e;
  }
}

async function index(col, key, type = 'key') {
  try {
    await databases.createIndex(DB_ID, col, `${key}_${type}`, type, [key]);
    console.log(`    index ${col}.${key}`);
  } catch (e) {
    if (String(e.message || e).includes('already exists')) return;
    // ignore index errors in cloud race conditions
  }
}

async function main() {
  console.log(`Appwrite setup → ${ENDPOINT}`);
  console.log(`Project: ${PROJECT}`);
  await ensureDb();

  await ensureCollection('profiles', 'Profiles');
  await str('profiles', 'email', 320, true);
  await str('profiles', 'full_name', 120, true);
  await str('profiles', 'avatar_url', 2048);
  await str('profiles', 'bio', 1000);
  await str('profiles', 'city', 120);
  await str('profiles', 'favorite_sport', 40);
  await float('profiles', 'total_distance_km');
  await int('profiles', 'total_activities');
  await int('profiles', 'current_streak');
  await int('profiles', 'longest_streak');
  await str('profiles', 'last_activity_date', 32);
  await index('profiles', 'email');

  await ensureCollection('clubs', 'Clubs');
  await str('clubs', 'name', 160, true);
  await str('clubs', 'slug', 160, true);
  await str('clubs', 'sport', 40, true);
  await str('clubs', 'city', 120, true);
  await str('clubs', 'description', 4000);
  await str('clubs', 'logo_url', 2048);
  await str('clubs', 'cover_url', 2048);
  await str('clubs', 'owner_email', 320, true);
  await str('clubs', 'club_password', 120);
  await int('clubs', 'member_count');
  await bool('clubs', 'is_verified');
  await str('clubs', 'subscription_status', 40);
  await str('clubs', 'instagram_link', 2048);
  await index('clubs', 'name');
  await index('clubs', 'sport');
  await index('clubs', 'city');

  await ensureCollection('club_events', 'Club Events');
  await str('club_events', 'club_id', 64, true);
  await str('club_events', 'club_name', 160);
  await str('club_events', 'title', 200, true);
  await str('club_events', 'description', 4000);
  await str('club_events', 'sport', 40);
  await str('club_events', 'date', 32, true);
  await str('club_events', 'time', 32);
  await str('club_events', 'meeting_point', 240);
  await float('club_events', 'distance_km');
  await str('club_events', 'cover_url', 2048);
  await str('club_events', 'attendance_password', 80);
  await int('club_events', 'max_participants');
  await index('club_events', 'club_id');
  await index('club_events', 'date');

  await ensureCollection('club_memberships', 'Club Memberships');
  await str('club_memberships', 'club_id', 64, true);
  await str('club_memberships', 'user_email', 320, true);
  await str('club_memberships', 'status', 40, true);
  await index('club_memberships', 'club_id');
  await index('club_memberships', 'user_email');

  await ensureCollection('activities', 'Activities');
  await str('activities', 'user_email', 320, true);
  await str('activities', 'user_name', 120);
  await str('activities', 'club_id', 64);
  await str('activities', 'club_name', 160);
  await str('activities', 'sport', 40, true);
  await float('activities', 'distance_km', true);
  await int('activities', 'duration_minutes');
  await str('activities', 'date', 32, true);
  await str('activities', 'notes', 2000);
  await str('activities', 'photo_url', 2048);
  await index('activities', 'user_email');
  await index('activities', 'date');

  await ensureCollection('leagues', 'Leagues');
  await str('leagues', 'name', 160, true);
  await str('leagues', 'sport', 40, true);
  await str('leagues', 'description', 2000);
  await str('leagues', 'created_by', 320, true);
  await str('leagues', 'creator_name', 120);
  await str('leagues', 'invite_code', 40, true);
  await str('leagues', 'start_date', 32, true);
  await str('leagues', 'end_date', 32, true);
  await str('leagues', 'status', 40);
  await int('leagues', 'max_members');
  await int('leagues', 'member_count');
  await index('leagues', 'invite_code');

  await ensureCollection('league_participants', 'League Participants');
  await str('league_participants', 'league_id', 64, true);
  await str('league_participants', 'user_email', 320, true);
  await str('league_participants', 'user_name', 120);
  await index('league_participants', 'league_id');
  await index('league_participants', 'user_email');

  await ensureCollection('event_participants', 'Event Participants');
  await str('event_participants', 'event_id', 64, true);
  await str('event_participants', 'user_email', 320, true);
  await str('event_participants', 'event_date', 32, true);
  await str('event_participants', 'event_title', 200);
  await str('event_participants', 'club_name', 160);
  await bool('event_participants', 'confirmed');
  await index('event_participants', 'user_email');
  await index('event_participants', 'event_id');

  await ensureCollection('friendships', 'Friendships');
  await str('friendships', 'requester_email', 320, true);
  await str('friendships', 'addressee_email', 320, true);
  await str('friendships', 'status', 40, true);
  await str('friendships', 'requester_name', 120);
  await index('friendships', 'addressee_email');
  await index('friendships', 'requester_email');

  await ensureCollection('memories', 'Memories');
  await str('memories', 'user_email', 320, true);
  await str('memories', 'title', 200, true);
  await str('memories', 'location', 200);
  await str('memories', 'photo_url', 2048, true);
  await str('memories', 'date', 32, true);
  await index('memories', 'user_email');

  await ensureCollection('merch', 'Merch');
  await str('merch', 'club_id', 64, true);
  await str('merch', 'name', 160, true);
  await float('merch', 'price', true);
  await str('merch', 'image_url', 2048);
  await str('merch', 'description', 2000);
  await index('merch', 'club_id');

  await ensureCollection('posts', 'Posts');
  await str('posts', 'user_email', 320, true);
  await str('posts', 'user_name', 120);
  await str('posts', 'club_id', 64);
  await str('posts', 'content', 4000, true);
  await str('posts', 'photo_url', 2048);
  await str('posts', 'created_date', 64);
  await int('posts', 'like_count');
  await index('posts', 'user_email');

  console.log('\nDone. Next: npm run seed:appwrite');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

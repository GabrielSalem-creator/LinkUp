/**
 * Seeds Lebanon demo clubs/events/leagues into Appwrite.
 * Run AFTER: node scripts/setup-appwrite.mjs
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
  console.error('Missing APPWRITE_API_KEY');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const databases = new Databases(client);

const today = new Date();
const d = (offset) => {
  const x = new Date(today);
  x.setDate(x.getDate() + offset);
  return x.toISOString().slice(0, 10);
};
const past = (offset) => d(-offset);

const perms = [
  Permission.read(Role.any()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function upsert(collectionId, documentId, data) {
  try {
    await databases.getDocument(DB_ID, collectionId, documentId);
    await databases.updateDocument(DB_ID, collectionId, documentId, data);
    console.log(`  updated ${collectionId}/${documentId}`);
  } catch {
    await databases.createDocument(DB_ID, collectionId, documentId, data, perms);
    console.log(`  created ${collectionId}/${documentId}`);
  }
}

const clubs = [
  {
    id: 'club-1',
    name: 'Run Club Beirut',
    slug: 'run-club-beirut',
    sport: 'running',
    city: 'Beirut',
    description: "Lebanon's biggest running community. Sunrise runs, tempo nights, and race prep.",
    logo_url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=200&h=200&fit=crop',
    cover_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=400&fit=crop',
    owner_email: 'owner@runclubbeirut.com',
    club_password: 'demo1234',
    member_count: 842,
    is_verified: true,
    subscription_status: 'active',
    instagram_link: 'https://instagram.com',
  },
  {
    id: 'club-2',
    name: 'Run Club Jounieh',
    slug: 'run-club-jounieh',
    sport: 'running',
    city: 'Jounieh',
    description: 'Coastal runs with sea views. All paces welcome.',
    logo_url: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=200&h=200&fit=crop',
    cover_url: 'https://images.unsplash.com/photo-1486218119243-13883505764c?w=800&h=400&fit=crop',
    owner_email: 'owner@runclubjounieh.com',
    member_count: 310,
    is_verified: true,
    subscription_status: 'active',
  },
  {
    id: 'club-3',
    name: 'Bike Club Beirut',
    slug: 'bike-club-beirut',
    sport: 'biking',
    city: 'Beirut',
    description: 'Road & gravel rides across Mount Lebanon.',
    logo_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&h=200&fit=crop',
    cover_url: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&h=400&fit=crop',
    owner_email: 'owner@bikeclubbeirut.com',
    member_count: 456,
    is_verified: true,
    subscription_status: 'active',
  },
  {
    id: 'club-5',
    name: 'Swim Beirut',
    slug: 'swim-beirut',
    sport: 'swimming',
    city: 'Beirut',
    description: 'Open water & pool sessions for every level.',
    logo_url: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=200&h=200&fit=crop',
    cover_url: 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&h=400&fit=crop',
    owner_email: 'owner@swimbeirut.com',
    member_count: 167,
    is_verified: true,
    subscription_status: 'active',
  },
  {
    id: 'club-6',
    name: 'Run Club Batroun',
    slug: 'run-club-batroun',
    sport: 'running',
    city: 'Batroun',
    description: 'Old souk warmups, lighthouse finishes.',
    logo_url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=200&h=200&fit=crop',
    cover_url: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&h=400&fit=crop',
    owner_email: 'owner@runclubbatroun.com',
    member_count: 224,
    is_verified: true,
    subscription_status: 'active',
  },
];

const events = [
  {
    id: 'ev-1',
    club_id: 'club-1',
    club_name: 'Run Club Beirut',
    title: 'Corniche Sunrise 10K',
    description: 'Easy-pace group run along the Corniche.',
    sport: 'running',
    date: d(0),
    time: '06:00',
    meeting_point: 'Raouche Rocks',
    distance_km: 10,
    max_participants: 80,
    cover_url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=400&fit=crop',
    attendance_password: 'run10',
  },
  {
    id: 'ev-2',
    club_id: 'club-3',
    club_name: 'Bike Club Beirut',
    title: 'Faqra Climb Saturday',
    sport: 'biking',
    date: d(0),
    time: '07:30',
    meeting_point: 'Dbayeh Highway',
    distance_km: 65,
    max_participants: 40,
    cover_url: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&h=400&fit=crop',
  },
  {
    id: 'ev-3',
    club_id: 'club-2',
    club_name: 'Run Club Jounieh',
    title: 'Coastal Tempo Night',
    sport: 'running',
    date: d(1),
    time: '18:30',
    meeting_point: 'Jounieh Bay',
    distance_km: 8,
    max_participants: 50,
  },
  {
    id: 'ev-4',
    club_id: 'club-5',
    club_name: 'Swim Beirut',
    title: 'Open Water Session',
    sport: 'swimming',
    date: d(1),
    time: '07:00',
    meeting_point: 'Sporting Club Beach',
    distance_km: 2,
    max_participants: 25,
    cover_url: 'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&h=400&fit=crop',
  },
  {
    id: 'ev-7',
    club_id: 'club-1',
    club_name: 'Run Club Beirut',
    title: 'Weekend Long Run',
    sport: 'running',
    date: d(5),
    time: '06:00',
    meeting_point: 'Horsh Beirut',
    distance_km: 20,
    max_participants: 100,
    cover_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=400&fit=crop',
  },
];

async function main() {
  console.log('Seeding LinkUp demo data…');
  for (const c of clubs) {
    const { id, ...data } = c;
    await upsert('clubs', id, data);
  }
  for (const e of events) {
    const { id, ...data } = e;
    await upsert('club_events', id, data);
  }

  await upsert('leagues', 'lg-1', {
    name: 'Beirut Summer Challenge',
    sport: 'running_walking',
    description: 'Who can stack the most km?',
    created_by: 'alex@linkup.app',
    creator_name: 'Alex Khoury',
    invite_code: 'BEIRUT26',
    start_date: past(14),
    end_date: d(16),
    status: 'active',
    max_members: 50,
    member_count: 1,
  });

  await upsert('league_participants', 'lp-1', {
    league_id: 'lg-1',
    user_email: 'alex@linkup.app',
    user_name: 'Alex Khoury',
  });

  await upsert('merch', 'merch-1', {
    club_id: 'club-1',
    name: 'RCB Tech Tee',
    price: 35,
    image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    description: 'Lightweight training tee',
  });

  await upsert('activities', 'a-seed-1', {
    user_email: 'maya@linkup.app',
    user_name: 'Maya Haddad',
    club_id: 'club-1',
    club_name: 'Run Club Beirut',
    sport: 'running',
    distance_km: 12,
    duration_minutes: 58,
    date: past(1),
  });

  console.log('\nSeed complete. Invite code: BEIRUT26 · Club portal password: demo1234');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

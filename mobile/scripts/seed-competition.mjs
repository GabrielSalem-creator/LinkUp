/**
 * Seeds STAGING competition/season data: competitions, seasons, teams (linked to existing clubs),
 * players, venues with sections/seats, matches, stat lines, rankings, team media and ticket offers.
 * Idempotent (upserts by deterministic IDs). Never touches community collections.
 *
 *   node scripts/seed-competition.mjs
 *   node scripts/seed-competition.mjs --enable-test-checkout   # fake provider demo (no real payments)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Databases, Functions, Query } from 'node-appwrite';

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
const DB = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'linkup';
const API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
  console.error('Missing APPWRITE_API_KEY');
  process.exit(1);
}
const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);
const functions = new Functions(client);
const enableTestCheckout = process.argv.includes('--enable-test-checkout');

const sid = (prefix, ...parts) => `${prefix}_${createHash('sha1').update(parts.join(':')).digest('hex').slice(0, 28)}`;
let created = 0;
let updated = 0;
async function upsert(collectionId, documentId, data) {
  try {
    await db.getDocument({ databaseId: DB, collectionId, documentId });
    await db.updateDocument({ databaseId: DB, collectionId, documentId, data });
    updated++;
  } catch (e) {
    if (e.code !== 404) throw e;
    await db.createDocument({ databaseId: DB, collectionId, documentId, data });
    created++;
  }
}

const now = new Date();
const day = (offset, hour = 18, minute = 0) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
};
const dateOnly = (offset) => day(offset).slice(0, 10);
const img = (id, w = 1200, h = 600) => `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop`;

/* --------------------------------- competitions --------------------------------- */
const competitions = [
  { id: 'cmp-lbl', name: 'Lebanese Basketball League', slug: 'lbl', sport: 'basketball', division: 'Division 1', gender: 'men', format: 'League', sort: 1, logo_url: img('photo-1546519638-68e109498ffc', 200, 200) },
  { id: 'cmp-lpl', name: 'Lebanese Premier League', slug: 'lpl', sport: 'football', division: 'Premier', gender: 'men', format: 'League', sort: 2, logo_url: img('photo-1579952363873-27f3bade9f55', 200, 200) },
  { id: 'cmp-futsal', name: 'Lebanese Futsal League', slug: 'futsal', sport: 'futsal', gender: 'men', format: 'League', sort: 3 },
  { id: 'cmp-volley', name: 'Lebanese Volleyball League', slug: 'volleyball', sport: 'volleyball', gender: 'men', format: 'League', sort: 4 },
  { id: 'cmp-hand', name: 'Lebanese Handball League', slug: 'handball', sport: 'handball', gender: 'men', format: 'League', sort: 5 },
  { id: 'cmp-tennis', name: 'Lebanese Tennis Rankings', slug: 'tennis', sport: 'tennis', format: 'Ranking', sort: 6 },
  { id: 'cmp-padel', name: 'Lebanese Padel Rankings', slug: 'padel', sport: 'padel', format: 'Ranking', sort: 7 },
  { id: 'cmp-racing', name: 'Lebanese Racing Championship', slug: 'racing', sport: 'racing', format: 'Championship', sort: 8 },
];

const seasonFor = (cmp, matchweeks) => ({
  id: `ssn-${cmp.slug}-2026`,
  competition_id: cmp.id,
  name: '2026/27',
  start_date: dateOnly(-60),
  end_date: dateOnly(120),
  status: 'active',
  is_current: true,
  matchweeks,
});
const prevSeasonFor = (cmp) => ({
  id: `ssn-${cmp.slug}-2025`,
  competition_id: cmp.id,
  name: '2025/26',
  start_date: dateOnly(-420),
  end_date: dateOnly(-100),
  status: 'completed',
  is_current: false,
  matchweeks: 0,
});

/* ------------------------------------- teams ------------------------------------- */
const team = (id, cmp, name, short, p, s, city, club_id) => ({ id, competition_id: cmp, name, short_name: short, primary_color: p, secondary_color: s, city, club_id, logo_url: null });
const teams = [
  // basketball
  team('t-riyadi', 'cmp-lbl', 'Al Riyadi Beirut', 'RIY', '#F4C400', '#1D1D1B', 'Beirut', 'club-1'),
  team('t-sagesse', 'cmp-lbl', 'Sagesse', 'SAG', '#0B6B3A', '#FFFFFF', 'Beirut', 'club-3'),
  team('t-beirut-club', 'cmp-lbl', 'Beirut Club', 'BEI', '#133440', '#5ABDB7', 'Beirut', 'club-5'),
  team('t-dynamo', 'cmp-lbl', 'Dynamo Lebanon', 'DYN', '#0057B8', '#FFFFFF', 'Beirut', null),
  team('t-homenetmen', 'cmp-lbl', 'Homenetmen', 'HOM', '#E8412C', '#1D1D1B', 'Beirut', null),
  team('t-champville', 'cmp-lbl', 'Champville', 'CHA', '#8E2F5A', '#FFFFFF', 'Dik El Mehdi', null),
  // football
  team('t-ansar', 'cmp-lpl', 'Al Ansar', 'ANS', '#0C7A3E', '#FFFFFF', 'Beirut', 'club-1'),
  team('t-nejmeh', 'cmp-lpl', 'Nejmeh', 'NEJ', '#9B1C1C', '#FFFFFF', 'Beirut', 'club-2'),
  team('t-ahed', 'cmp-lpl', 'Al Ahed', 'AHD', '#F4C400', '#1D1D1B', 'Beirut', 'club-3'),
  team('t-safa', 'cmp-lpl', 'Safa', 'SAF', '#1A4FA3', '#FFFFFF', 'Beirut', 'club-6'),
  team('t-bourj', 'cmp-lpl', 'Bourj', 'BRJ', '#3C3C3C', '#FF5E4A', 'Beirut', null),
  team('t-tripoli', 'cmp-lpl', 'Tripoli SC', 'TRI', '#0E8F72', '#FFFFFF', 'Tripoli', null),
  // futsal
  team('t-bankbeirut', 'cmp-futsal', 'Bank of Beirut', 'BOB', '#133440', '#F4C400', 'Beirut', null),
  team('t-mayadeen', 'cmp-futsal', 'Al Mayadeen', 'MAY', '#8E2F5A', '#FFFFFF', 'Beirut', null),
  team('t-jouniehf', 'cmp-futsal', 'Jounieh Futsal', 'JOU', '#5ABDB7', '#133440', 'Jounieh', 'club-2'),
  team('t-sadaka', 'cmp-futsal', 'Al Sadaka', 'SAD', '#E8412C', '#FFFFFF', 'Beirut', null),
  // volleyball
  team('t-vspeed', 'cmp-volley', 'Speed Volley', 'SPD', '#FF5E4A', '#133440', 'Beirut', null),
  team('t-vbouar', 'cmp-volley', 'Bouar', 'BOU', '#1A4FA3', '#FFFFFF', 'Bouar', null),
  team('t-vzahle', 'cmp-volley', 'Zahle Volley', 'ZAH', '#0B6B3A', '#FFFFFF', 'Zahle', null),
  team('t-vanwar', 'cmp-volley', 'Anwar Hadath', 'ANW', '#9B1C1C', '#F4C400', 'Hadath', null),
  // handball
  team('t-hsagesse', 'cmp-hand', 'Sagesse HB', 'SAG', '#0B6B3A', '#FFFFFF', 'Beirut', null),
  team('t-hchabab', 'cmp-hand', 'Chabab Ghazieh', 'CGH', '#133440', '#FF5E4A', 'Ghazieh', null),
  team('t-hjamhour', 'cmp-hand', 'Jamhour HB', 'JAM', '#E8412C', '#1D1D1B', 'Jamhour', null),
  team('t-hsouk', 'cmp-hand', 'Souk El Gharb', 'SEG', '#0057B8', '#FFFFFF', 'Souk El Gharb', null),
];

/* ------------------------------------ players ------------------------------------ */
const P = [];
let pseq = 0;
const player = (full_name, nationality, position, teamId, gender = 'men', shirt) => {
  pseq++;
  const id = `pl-${String(pseq).padStart(3, '0')}`;
  P.push({ id, full_name, nationality, is_lebanese: nationality === 'LB', position, gender, teamId, shirt: shirt ?? pseq % 40 });
  return id;
};
const roster = (teamId, names, positions) => names.map((n, i) => player(n[0], n[1], positions[i % positions.length], teamId));
const bbPos = ['PG', 'SG', 'SF', 'PF', 'C'];
const fbPos = ['GK', 'DF', 'MF', 'FW', 'FW'];
const hbPos = ['GK', 'LW', 'CB', 'RW', 'PV'];
const bb = {
  't-riyadi': roster('t-riyadi', [['Wael Arakji', 'LB'], ['Ali Haidar', 'LB'], ['Jonathan Arledge', 'US'], ['Amir Saoud', 'LB'], ['Karim Zeinoun', 'LB'], ['Ater Majok', 'AU']], bbPos),
  't-sagesse': roster('t-sagesse', [['Ali Mezher', 'LB'], ['Sergio El Darwich', 'LB'], ['Dewayne Jackson', 'US'], ['Charles Tabet', 'LB'], ['Omar Ayoubi', 'LB']], bbPos),
  't-beirut-club': roster('t-beirut-club', [['Hayk Gyokchyan', 'LB'], ['Elie Rustom', 'LB'], ['Josh Sharma', 'US'], ['Rony Fahed', 'LB'], ['Karim Ezzeddine', 'LB']], bbPos),
  't-dynamo': roster('t-dynamo', [['Joseph Haddad', 'LB'], ['Michel Rizk', 'LB'], ['Trey Jones', 'US'], ['Fadi Khoury', 'LB'], ['Nassim Ghandour', 'LB']], bbPos),
  't-homenetmen': roster('t-homenetmen', [['Garabed Keshishian', 'LB'], ['Aram Bedrossian', 'LB'], ['Marcus Lee', 'US'], ['Vahe Minassian', 'LB'], ['Shant Sarkis', 'LB']], bbPos),
  't-champville': roster('t-champville', [['Jad Khalil', 'LB'], ['Elie Chamoun', 'LB'], ['Devin Lewis', 'US'], ['Marc Aoun', 'LB'], ['Toni Geagea', 'LB']], bbPos),
};
const fb = {
  't-ansar': roster('t-ansar', [['Mostafa Matar', 'LB'], ['Nour Mansour', 'LB'], ['Hassan Chaito', 'LB'], ['Hassan Maatouk', 'LB'], ['Souleymane Diallo', 'GN'], ['Mahdi Zein', 'LB']], fbPos),
  't-nejmeh': roster('t-nejmeh', [['Ali Sabeh', 'LB'], ['Kassem El Zein', 'LB'], ['Mohamad Haidar', 'LB'], ['Hassan Mohamed', 'LB'], ['Mark Sabha', 'LB'], ['Tope Ayodele', 'NG']], fbPos),
  't-ahed': roster('t-ahed', [['Mehdi Khalil', 'LB'], ['Hussein Dakik', 'LB'], ['Ahmad Zreik', 'LB'], ['Issah Yakubu', 'GH'], ['Hussein El Dor', 'LB'], ['Rabih Ataya', 'LB']], fbPos),
  't-safa': roster('t-safa', [['Jad Yahya', 'LB'], ['Mohamad Alaa', 'LB'], ['Nader Matar', 'LB'], ['Walid Shour', 'LB'], ['Carlos Pacheco', 'BR']], fbPos),
  't-bourj': roster('t-bourj', [['Karim Zaatari', 'LB'], ['Omar Kabbani', 'LB'], ['Ali Fakih', 'LB'], ['Bassel Jradi', 'LB'], ['Mamadou Sow', 'SN']], fbPos),
  't-tripoli': roster('t-tripoli', [['Ahmad Takkoush', 'LB'], ['Khaled Hamie', 'LB'], ['Samir Ayass', 'LB'], ['Ali Hajj', 'LB'], ['Emeka Obi', 'NG']], fbPos),
};
const fs = {
  't-bankbeirut': roster('t-bankbeirut', [['Karim Abou Zeid', 'LB'], ['Ahmad Kheir', 'LB'], ['Rafael Lima', 'BR'], ['Mohamad Tabbara', 'LB'], ['Ali Tneich', 'LB']], fbPos),
  't-mayadeen': roster('t-mayadeen', [['Hadi Mokdad', 'LB'], ['Ali Moussa', 'LB'], ['Pedro Silva', 'BR'], ['Jad Sleiman', 'LB'], ['Hussein Awada', 'LB']], fbPos),
  't-jouniehf': roster('t-jouniehf', [['Charbel Nassif', 'LB'], ['Elie Kfoury', 'LB'], ['Paulo Sousa', 'BR'], ['Antoine Saad', 'LB'], ['Georges Nehme', 'LB']], fbPos),
  't-sadaka': roster('t-sadaka', [['Bilal Hammoud', 'LB'], ['Omar Jaber', 'LB'], ['Lucas Costa', 'BR'], ['Ali Harb', 'LB'], ['Mahmoud Saleh', 'LB']], fbPos),
};
const hb = {
  't-hsagesse': roster('t-hsagesse', [['Elie Khoury', 'LB'], ['Joe Saab', 'LB'], ['Nabil Abou Jaoude', 'LB'], ['Marwan Tabet', 'LB'], ['Rami Daou', 'LB']], hbPos),
  't-hchabab': roster('t-hchabab', [['Hassan Fawaz', 'LB'], ['Ali Ghazieh', 'LB'], ['Mohamad Younes', 'LB'], ['Hadi Jaber', 'LB'], ['Ahmad Kassem', 'LB']], hbPos),
  't-hjamhour': roster('t-hjamhour', [['Karim Assaf', 'LB'], ['Fadi Sfeir', 'LB'], ['Tony Abi Nader', 'LB'], ['Chadi Rahme', 'LB'], ['Jean Khalil', 'LB']], hbPos),
  't-hsouk': roster('t-hsouk', [['Omar Hamdan', 'LB'], ['Samer Kanaan', 'LB'], ['Wissam Salloum', 'LB'], ['Ziad Chehab', 'LB'], ['Mazen Hajjar', 'LB']], hbPos),
};
// individuals (rankings)
const tennisMen = ['Hady Habib', 'Benjamin Hassan', 'Giovani Samaha', 'Karim Sayegh', 'Omar Khoury', 'Ralph Nader', 'Elie Maalouf', 'Marc Daher', 'Jad Bou Habib', 'Anthony Jreij', 'Karl Rizk', 'Tarek Haddad', 'Sami Kassab', 'Jean Marc Chidiac', 'Nabil Hachem', 'Ali Safa', 'Rayan Fakhoury', 'Chadi Ghosn', 'Peter Moukarzel', 'Elias Sawaya', 'Hassan Baalbaki', 'Charbel Maroun', 'Rami Chehade', 'George Bitar', 'Kevin Farah', 'Michel Azar', 'Bassem Rizk', 'Fadi Aoun', 'Joseph Nasr', 'Omar Sleiman', 'Ramzi Khalaf'].map((n) => player(n, 'LB', 'Tennis', null, 'men'));
const tennisWomen = ['Aya Bou Diab', 'Lea Kassab', 'Nour Abbes', 'Yara Haddad', 'Maya Khoury', 'Tala Sleiman', 'Rita Azar', 'Nathalie Ghorayeb', 'Dana Rizk', 'Mira Saab', 'Lynn Fakhoury', 'Sara Maalouf', 'Jana Hachem', 'Reem Baalbaki', 'Celine Daher', 'Mia Nasr', 'Zeina Farah', 'Lara Jreij', 'Nadine Chehade', 'Carla Bitar', 'Hala Moukarzel'].map((n) => player(n, 'LB', 'Tennis', null, 'women'));
const padelNames = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
const padel = {};
for (const g of ['men', 'women']) {
  for (const k of ['a', 'b', 'c', 'd']) {
    padel[`padel_${g}_${k}`] = padelNames(`${g === 'men' ? 'M' : 'W'}${k.toUpperCase()} Player`, 8).map((n) => player(n, 'LB', 'Padel', null, g));
  }
}
const drivers = ['Nicolas Amiouni', 'Karl Ghanem', 'Rodrigue Rahi', 'Eddy Abou Karam', 'Abdo Feghali', 'Roger Feghali', 'Gilbert Bannout', 'Tamer Ghandour', 'Marc Azzam', 'Henry Kahy', 'Jad Hajj', 'Fadi Hachem'].map((n) => player(n, 'LB', 'Driver', null, 'men'));

/* ------------------------------------- venues ------------------------------------- */
const venues = [
  { id: 'v-chamoun', name: 'Camille Chamoun Sports City', city: 'Beirut', address: 'Bir Hassan, Beirut', capacity: 4000, image_url: img('photo-1522778119026-d647f0596c20') },
  { id: 'v-nouhad', name: 'Nouhad Nawfal Stadium', city: 'Zouk Mikael', address: 'Zouk Mikael', capacity: 2200, image_url: img('photo-1459865264687-595d652de67e') },
  { id: 'v-manara', name: 'Manara Arena', city: 'Beirut', address: 'Manara, Beirut', capacity: 1500, image_url: img('photo-1504450758481-7338eba7524a') },
  { id: 'v-saida', name: 'Saida Municipal Stadium', city: 'Saida', address: 'Saida', capacity: 1800, image_url: img('photo-1489944440615-453fc2b6a9a9') },
];
// geometry in a 0..100 grid; the pitch/court sits in the middle
const sectionDefs = (venueId, prefix, scale) => [
  { id: `${prefix}-north`, code: 'N', name: 'North Stand', kind: 'ga', capacity: Math.round(300 * scale), rows: 0, seats_per_row: 0, geometry: { x: 20, y: 4, w: 60, h: 14, side: 'north' }, accessible: false, sort: 1 },
  { id: `${prefix}-south`, code: 'S', name: 'South Stand', kind: 'ga', capacity: Math.round(300 * scale), rows: 0, seats_per_row: 0, geometry: { x: 20, y: 82, w: 60, h: 14, side: 'south' }, accessible: true, sort: 2 },
  { id: `${prefix}-east`, code: 'E', name: 'East Tribune', kind: 'assigned', capacity: 60, rows: 6, seats_per_row: 10, geometry: { x: 84, y: 22, w: 13, h: 56, side: 'east' }, accessible: true, sort: 3 },
  { id: `${prefix}-west`, code: 'W', name: 'West VIP', kind: 'assigned', capacity: 40, rows: 4, seats_per_row: 10, geometry: { x: 3, y: 22, w: 13, h: 56, side: 'west' }, accessible: true, sort: 0 },
].map((s) => ({ ...s, venue_id: venueId, geometry: JSON.stringify(s.geometry) }));
const sections = [...sectionDefs('v-chamoun', 'sec-ch', 1), ...sectionDefs('v-nouhad', 'sec-nn', 0.6), ...sectionDefs('v-manara', 'sec-mn', 0.4), ...sectionDefs('v-saida', 'sec-sd', 0.5)];
const seatsFor = (sec) => {
  const out = [];
  if (sec.kind !== 'assigned') return out;
  for (let r = 0; r < sec.rows; r++) {
    const row = String.fromCharCode(65 + r);
    for (let n = 1; n <= sec.seats_per_row; n++) {
      const kind = r === 0 && n <= 2 ? 'accessible' : r === 0 && n <= 4 ? 'companion' : 'standard';
      out.push({ id: `st-${sec.id.replace('sec-', '')}-${row}${n}`, venue_id: sec.venue_id, section_id: sec.id, row_label: row, seat_number: n, kind, label: `${row}${n}` });
    }
  }
  return out;
};

/* ------------------------------------- matches ------------------------------------- */
const M = [];
let mseq = 0;
function fixtures(cmp, seasonId, teamIds, venueIds, startOffset, weeksPlayed) {
  // simple round robin: each matchweek pairs teams
  const n = teamIds.length;
  const rounds = n - 1;
  const arr = [...teamIds];
  for (let w = 0; w < rounds; w++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      mseq++;
      const weekOffset = startOffset + w * 7;
      const played = w < weeksPlayed;
      const live = w === weeksPlayed && i === 0;
      M.push({
        id: `m-${cmp.slug}-${String(mseq).padStart(3, '0')}`,
        competition_id: cmp.id,
        season_id: seasonId,
        home_team_id: home,
        away_team_id: away,
        venue_id: venueIds[(w + i) % venueIds.length],
        kickoff_at: day(weekOffset + (i % 2), 17 + i, i % 2 ? 30 : 0),
        matchweek: w + 1,
        round_label: `Matchweek ${w + 1}`,
        status: played ? 'final' : live ? 'live' : w === weeksPlayed + 1 && i === 1 ? 'postponed' : 'scheduled',
        published: true,
        result_version: played ? 1 : 0,
        note: null,
        home_score: null,
        away_score: null,
        score_detail: null,
        media_override_home: null,
        media_override_away: null,
        _sport: cmp.sport,
        _w: w,
        _i: i,
      });
    }
    arr.splice(1, 0, arr.pop());
  }
}
const rng = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const rand = rng(42);
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));

/* ------------------------------------- main ------------------------------------- */
async function main() {
  console.log(`Seeding competition data -> ${ENDPOINT} / ${PROJECT} / ${DB}`);
  for (const c of competitions) {
    const { id, ...data } = c;
    await upsert('competitions', id, { status: 'published', country: 'LB', category: null, tiebreak_note: null, division: null, gender: null, format: null, logo_url: null, ...data });
  }
  const seasons = [];
  for (const c of competitions) {
    const s = seasonFor(c, ['tennis', 'padel', 'racing'].includes(c.sport) ? 0 : 10);
    seasons.push(s);
    const { id, ...data } = s;
    await upsert('seasons', id, data);
    const p = prevSeasonFor(c);
    const { id: pid, ...pdata } = p;
    await upsert('seasons', pid, pdata);
  }
  for (const t of teams) {
    const { id, ...data } = t;
    await upsert('competition_teams', id, data);
  }
  for (const p of P) {
    await upsert('players', p.id, { full_name: p.full_name, nationality: p.nationality, is_lebanese: p.is_lebanese, position: p.position, gender: p.gender, photo_url: null, birth_year: null });
  }
  const seasonOf = (cmpId) => seasons.find((s) => s.competition_id === cmpId).id;
  for (const p of P) {
    if (!p.teamId) continue;
    const t = teams.find((x) => x.id === p.teamId);
    await upsert('team_players', `tp-${p.id}`, { season_id: seasonOf(t.competition_id), team_id: p.teamId, player_id: p.id, shirt_number: p.shirt, role: 'player' });
  }
  for (const v of venues) {
    const { id, ...data } = v;
    await upsert('venues', id, data);
  }
  for (const s of sections) {
    const { id, ...data } = s;
    await upsert('venue_sections', id, data);
    for (const seat of seatsFor(s)) {
      const { id: sid, ...sdata } = seat;
      await upsert('venue_seats', sid, sdata);
    }
  }
  // team media (default + competition-level) so every fallback level is exercised
  const stadiumImgs = ['photo-1522778119026-d647f0596c20', 'photo-1459865264687-595d652de67e', 'photo-1504450758481-7338eba7524a', 'photo-1489944440615-453fc2b6a9a9', 'photo-1518604666860-9ed391f76460', 'photo-1577223625816-7546f13df25d'];
  let mi = 0;
  for (const t of teams) {
    mi++;
    if (mi % 3 === 0) continue; // some teams have no media at all -> colours + logo fallback
    await upsert('team_media', sid('tm', t.id, 'default'), { team_id: t.id, kind: 'default', competition_id: null, venue_id: null, image_url: img(stadiumImgs[mi % stadiumImgs.length]), sort: 0 });
    if (mi % 2 === 0) {
      await upsert('team_media', sid('tm', t.id, 'cmp'), { team_id: t.id, kind: 'competition', competition_id: t.competition_id, venue_id: null, image_url: img(stadiumImgs[(mi + 1) % stadiumImgs.length]), sort: 0 });
    }
    if (mi % 4 === 1) {
      await upsert('team_media', sid('tm', t.id, 'venue'), { team_id: t.id, kind: 'venue', competition_id: null, venue_id: 'v-chamoun', image_url: img(stadiumImgs[(mi + 2) % stadiumImgs.length]), sort: 0 });
    }
  }

  // fixtures
  const byCmp = (cmpId) => teams.filter((t) => t.competition_id === cmpId).map((t) => t.id);
  fixtures(competitions[0], seasonOf('cmp-lbl'), byCmp('cmp-lbl'), ['v-manara', 'v-chamoun'], -21, 3);
  fixtures(competitions[1], seasonOf('cmp-lpl'), byCmp('cmp-lpl'), ['v-chamoun', 'v-nouhad', 'v-saida'], -21, 3);
  fixtures(competitions[2], seasonOf('cmp-futsal'), byCmp('cmp-futsal'), ['v-manara'], -14, 2);
  fixtures(competitions[3], seasonOf('cmp-volley'), byCmp('cmp-volley'), ['v-manara'], -14, 2);
  fixtures(competitions[4], seasonOf('cmp-hand'), byCmp('cmp-hand'), ['v-manara', 'v-saida'], -14, 2);

  for (const m of M) {
    const { id, _sport, _w, _i, ...data } = m;
    if (m.status === 'final' || m.status === 'live') {
      if (_sport === 'basketball') {
        data.home_score = ri(68, 96);
        data.away_score = ri(66, 95);
        if (data.home_score === data.away_score) data.home_score += 2;
      } else if (_sport === 'volleyball') {
        const hs = ri(0, 1) ? 3 : ri(0, 2);
        const as = hs === 3 ? ri(0, 2) : 3;
        data.home_score = hs;
        data.away_score = as;
        const sets = [];
        let h = 0;
        let a = 0;
        while (h < hs || a < as) {
          if (h < hs && (a >= as || rand() > 0.5)) {
            sets.push([25, ri(15, 23)]);
            h++;
          } else {
            sets.push([ri(15, 23), 25]);
            a++;
          }
        }
        data.score_detail = JSON.stringify({ sets });
      } else if (_sport === 'handball') {
        data.home_score = ri(22, 34);
        data.away_score = ri(20, 33);
      } else {
        data.home_score = ri(0, 4);
        data.away_score = ri(0, 3);
      }
      if (m.status === 'live') {
        data.home_score = Math.max(0, Math.floor(data.home_score / 2));
        data.away_score = Math.max(0, Math.floor(data.away_score / 2));
        if (_sport === 'volleyball') data.score_detail = null;
      }
    }
    await upsert('matches', id, data);
  }

  // player stat lines for final matches (deterministic)
  const rosterOf = (teamId) => P.filter((p) => p.teamId === teamId);
  let lines = 0;
  for (const m of M.filter((x) => x.status === 'final')) {
    for (const teamId of [m.home_team_id, m.away_team_id]) {
      const r = rosterOf(teamId);
      if (m._sport === 'basketball') {
        for (const p of r) {
          for (const [code, lo, hi] of [['pts', 2, 28], ['ast', 0, 9], ['reb', 1, 12], ['stl', 0, 4], ['blk', 0, 3]]) {
            await upsert('match_player_stats', sid('mps', m.id, p.id, code), { match_id: m.id, team_id: teamId, player_id: p.id, stat_code: code, value: ri(lo, hi) });
            lines++;
          }
        }
      } else if (m._sport === 'football' || m._sport === 'futsal') {
        const isHome = teamId === m.home_team_id;
        const goals = isHome ? M.find((x) => x.id === m.id) && 0 : 0;
        void goals;
        const scorers = r.filter((p) => p.position !== 'GK');
        let remaining = ri(0, 3);
        for (const p of scorers) {
          if (remaining <= 0) break;
          const g = Math.min(remaining, ri(1, 2));
          remaining -= g;
          await upsert('match_player_stats', sid('mps', m.id, p.id, 'goals'), { match_id: m.id, team_id: teamId, player_id: p.id, stat_code: 'goals', value: g });
          lines++;
          if (rand() > 0.5) {
            const assister = scorers[ri(0, scorers.length - 1)];
            await upsert('match_player_stats', sid('mps', m.id, assister.id, 'assists'), { match_id: m.id, team_id: teamId, player_id: assister.id, stat_code: 'assists', value: 1 });
            lines++;
          }
        }
        if (rand() > 0.6) {
          const carded = scorers[ri(0, scorers.length - 1)];
          await upsert('match_player_stats', sid('mps', m.id, carded.id, 'yellow_cards'), { match_id: m.id, team_id: teamId, player_id: carded.id, stat_code: 'yellow_cards', value: 1 });
          lines++;
        }
        if (rand() > 0.9) {
          const sent = scorers[ri(0, scorers.length - 1)];
          await upsert('match_player_stats', sid('mps', m.id, sent.id, 'red_cards'), { match_id: m.id, team_id: teamId, player_id: sent.id, stat_code: 'red_cards', value: 1 });
          lines++;
        }
        const gk = r.find((p) => p.position === 'GK');
        if (gk && rand() > 0.5) {
          await upsert('match_player_stats', sid('mps', m.id, gk.id, 'clean_sheets'), { match_id: m.id, team_id: teamId, player_id: gk.id, stat_code: 'clean_sheets', value: 1 });
          lines++;
        }
        await upsert('match_team_stats', sid('mts', m.id, teamId, 'shots'), { match_id: m.id, team_id: teamId, stat_code: 'shots', value: ri(4, 18) });
        await upsert('match_team_stats', sid('mts', m.id, teamId, 'corners'), { match_id: m.id, team_id: teamId, stat_code: 'corners', value: ri(1, 9) });
      } else if (m._sport === 'handball') {
        for (const p of r) {
          const codes = p.position === 'GK' ? [['gk_saves', 4, 16]] : [['goals', 0, 9], ['assists', 0, 5], ['blocks', 0, 3], ['steals', 0, 3]];
          for (const [code, lo, hi] of codes) {
            await upsert('match_player_stats', sid('mps', m.id, p.id, code), { match_id: m.id, team_id: teamId, player_id: p.id, stat_code: code, value: ri(lo, hi) });
            lines++;
          }
        }
      }
    }
  }
  console.log(`  stat lines: ${lines}`);

  // rankings (manual points) for tennis / padel / racing
  const rankingSeason = { tennis: seasonOf('cmp-tennis'), padel: seasonOf('cmp-padel'), racing: seasonOf('cmp-racing') };
  const writeBoard = async (seasonId, board, ids, basePts) => {
    const pts = ids.map((id, i) => ({ id, points: Math.max(10, basePts - i * ri(20, 60)) }));
    pts.sort((a, b) => b.points - a.points);
    for (let i = 0; i < pts.length; i++) {
      await upsert('ranking_entries', sid('rk', seasonId, board, pts[i].id), { season_id: seasonId, board_code: board, player_id: pts[i].id, rank: i + 1, points: pts[i].points, previous_rank: Math.min(pts.length, i + 1 + ri(-2, 2)) });
    }
  };
  await writeBoard(rankingSeason.tennis, 'tennis_men', tennisMen.slice(0, 30), 2400);
  await writeBoard(rankingSeason.tennis, 'tennis_women', tennisWomen.slice(0, 20), 1800);
  for (const [board, ids] of Object.entries(padel)) await writeBoard(rankingSeason.padel, board, ids, 900);
  await writeBoard(rankingSeason.racing, 'racing_drivers', drivers, 320);

  // ticket offers for upcoming published matches with a venue (first 2 weeks ahead)
  let offers = 0;
  for (const m of M.filter((x) => x.status === 'scheduled' && x.venue_id)) {
    const kickoff = Date.parse(m.kickoff_at);
    if (kickoff - Date.now() > 21 * 86400000) continue;
    const secs = sections.filter((s) => s.venue_id === m.venue_id);
    for (const s of secs) {
      const price = s.kind === 'assigned' ? (s.code === 'W' ? 4000 : 2500) : 1000;
      const notYet = m._w === 5 && s.code === 'S'; // one section that is not on sale yet
      await upsert('ticket_offers', sid('off', m.id, s.code), {
        match_id: m.id,
        section_id: s.id,
        name: s.name,
        kind: s.kind,
        price_minor: price,
        fee_minor: Math.round(price * 0.05),
        currency: 'USD',
        sale_start: notYet ? day(3) : day(-30),
        sale_end: new Date(kickoff - 3600000).toISOString(),
        status: 'on_sale',
        max_per_order: 6,
        capacity: s.capacity,
      });
      offers++;
    }
  }
  // one sold-out-style example: tiny capacity offer
  const soonMatch = M.find((x) => x.status === 'scheduled' && x.venue_id && Date.parse(x.kickoff_at) - Date.now() < 21 * 86400000);
  if (soonMatch) {
    await upsert('ticket_offers', sid('off', soonMatch.id, 'LAST'), {
      match_id: soonMatch.id,
      section_id: sections.find((s) => s.venue_id === soonMatch.venue_id && s.kind === 'ga').id,
      name: 'Last-minute standing (2 left)',
      kind: 'ga',
      price_minor: 500,
      fee_minor: 25,
      currency: 'USD',
      sale_start: day(-30),
      sale_end: new Date(Date.parse(soonMatch.kickoff_at) - 3600000).toISOString(),
      status: 'on_sale',
      max_per_order: 2,
      capacity: 2,
    });
  }
  console.log(`  ticket offers: ${offers}`);

  // settings
  const settings = {
    competition_enabled: true,
    checkout_enabled: enableTestCheckout,
    refunds_enabled: false,
    provider: enableTestCheckout ? 'fake' : 'none',
    hold_ttl_seconds: 600,
    currency: 'USD',
    note: enableTestCheckout ? 'TEST MODE: fake provider, no real payments. Disable before go-live.' : 'Checkout disabled until a payment provider is approved.',
  };
  await upsert('app_settings', 'ticketing', settings);

  // recalculate derived standings/leaderboards for every team-sport season through the server function
  console.log('  recalculating standings & leaderboards via function…');
  for (const s of seasons) {
    const cmp = competitions.find((c) => c.id === s.competition_id);
    if (['tennis', 'padel', 'racing'].includes(cmp.sport)) continue;
    try {
      const exec = await functions.createExecution({ functionId: 'linkup-api', xpath: `/admin/seasons/${s.id}/recalculate`, method: 'POST', body: '{}', headers: {} });
      // API-key executions carry no user; fall back to direct derivation if the function denies
      if (exec.responseStatusCode !== 200) throw new Error(`${exec.responseStatusCode} ${exec.responseBody}`);
      console.log(`    ${s.id}: ${exec.responseBody}`);
    } catch (e) {
      console.log(`    ${s.id}: function recalc unavailable (${String(e.message).slice(0, 80)}); run as an app admin from the app or scripts/recalc-season.mjs`);
    }
  }
  console.log(`\nSeed complete: ${created} created, ${updated} updated. Test checkout: ${enableTestCheckout ? 'ENABLED (fake provider)' : 'disabled'}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

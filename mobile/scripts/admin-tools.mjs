/**
 * Staging admin utilities.
 *
 *   node scripts/admin-tools.mjs ensure-admin <email> <password> [name]   # create user + app-admins membership
 *   node scripts/admin-tools.mjs revoke-admin <email>                      # remove from app-admins
 *   node scripts/admin-tools.mjs recalc-all <email> <password>             # recalc every team-sport season as that admin
 *   node scripts/admin-tools.mjs call <email> <password> <METHOD> <path> [jsonBody]
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Databases, ExecutionMethod, Functions, ID, Query, Teams, Users } from 'node-appwrite';

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

export const ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
export const PROJECT = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID || '6a61202f000e451a56a8';
export const DB = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID || 'linkup';
const API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
  console.error('Missing APPWRITE_API_KEY');
  process.exit(1);
}
export const admin = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const users = new Users(admin);
const teams = new Teams(admin);
const db = new Databases(admin);

export async function ensureUser(email, password, name = 'LinkUp User') {
  const found = await users.list({ queries: [Query.equal('email', email), Query.limit(1)] });
  if (found.users[0]) return found.users[0];
  return users.create({ userId: ID.unique(), email, password, name });
}

export async function setAdmin(userId, on) {
  const m = await teams.listMemberships({ teamId: 'app-admins', queries: [Query.equal('userId', userId), Query.limit(1)] });
  const cur = m.memberships[0];
  if (on && !cur) {
    await teams.createMembership({ teamId: 'app-admins', roles: ['admin'], userId });
    return 'added';
  }
  if (!on && cur) {
    await teams.deleteMembership({ teamId: 'app-admins', membershipId: cur.$id });
    return 'removed';
  }
  return 'unchanged';
}

/** Returns a client authenticated as the user (server-created session). */
export async function sessionClientFor(userId) {
  const session = await users.createSession({ userId });
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setSession(session.secret);
}

export async function callAs(client, method, path, body) {
  const fns = new Functions(client);
  const exec = await fns.createExecution({
    functionId: 'linkup-api',
    xpath: path,
    method: ExecutionMethod[method],
    body: body == null ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  let parsed = null;
  try {
    parsed = exec.responseBody ? JSON.parse(exec.responseBody) : null;
  } catch {
    parsed = exec.responseBody;
  }
  return { status: exec.responseStatusCode, body: parsed, logs: exec.logs, errors: exec.errors };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'ensure-admin') {
    const [email, password, name] = rest;
    const u = await ensureUser(email, password, name || 'App Admin');
    const r = await setAdmin(u.$id, true);
    console.log(`admin ${email} (${u.$id}): membership ${r}`);
  } else if (cmd === 'revoke-admin') {
    const [email] = rest;
    const found = await users.list({ queries: [Query.equal('email', email), Query.limit(1)] });
    if (!found.users[0]) throw new Error('no such user');
    console.log(`revoke ${email}: ${await setAdmin(found.users[0].$id, false)}`);
  } else if (cmd === 'recalc-all') {
    const [email] = rest;
    const found = await users.list({ queries: [Query.equal('email', email), Query.limit(1)] });
    if (!found.users[0]) throw new Error('no such user');
    const client = await sessionClientFor(found.users[0].$id);
    const seasons = await db.listDocuments({ databaseId: DB, collectionId: 'seasons', queries: [Query.equal('is_current', true), Query.limit(100)] });
    for (const s of seasons.documents) {
      const cmp = await db.getDocument({ databaseId: DB, collectionId: 'competitions', documentId: s.competition_id });
      if (['tennis', 'padel', 'racing'].includes(cmp.sport)) continue;
      const r = await callAs(client, 'POST', `/admin/seasons/${s.$id}/recalculate`, {});
      console.log(`${s.$id}: ${r.status} ${JSON.stringify(r.body)}`);
    }
  } else if (cmd === 'call') {
    const [email, , method, path, json] = rest;
    const found = await users.list({ queries: [Query.equal('email', email), Query.limit(1)] });
    if (!found.users[0]) throw new Error('no such user');
    const client = await sessionClientFor(found.users[0].$id);
    const r = await callAs(client, method, path, json ? JSON.parse(json) : undefined);
    console.log(r.status, JSON.stringify(r.body, null, 2));
    if (r.errors) console.log('errors:', r.errors);
  } else {
    console.log('commands: ensure-admin | revoke-admin | recalc-all | call');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

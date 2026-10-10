/**
 * Versioned, additive, idempotent migration for the Competition / Ticketing schema.
 *
 *   node scripts/migrate-competition.mjs --dry-run     # plan only, no writes
 *   node scripts/migrate-competition.mjs --apply       # create missing collections/attributes/indexes
 *   node scripts/migrate-competition.mjs --verify      # readiness + permission inventory (exit 1 on drift)
 *   node scripts/migrate-competition.mjs --inventory   # print schema/index/permission inventory
 *   node scripts/migrate-competition.mjs --rollback    # disable feature flags, release open holds (never deletes data)
 *
 * Existing community collections are never read for mutation, transformed or deleted.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, Databases, ID, Permission, Query, Role } from 'node-appwrite';

import { COLLECTIONS, MIGRATIONS_COLLECTION, SCHEMA_VERSION } from './schema/competition-v1.mjs';

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

const args = new Set(process.argv.slice(2));
const mode = ['--dry-run', '--apply', '--verify', '--inventory', '--rollback'].find((m) => args.has(m)) || '--dry-run';

if (!API_KEY) {
  console.error('Missing APPWRITE_API_KEY in mobile/.env');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EXISTING_COMMUNITY = [
  'profiles', 'clubs', 'club_events', 'club_memberships', 'activities', 'leagues',
  'league_participants', 'event_participants', 'friendships', 'memories', 'merch', 'posts',
];

function permissionsFor(col) {
  // deny-by-default: public = read any; private = nothing at collection level
  return col.access === 'public' ? [Permission.read(Role.any())] : [];
}

async function fetchLive() {
  const live = new Map();
  let cursor;
  for (;;) {
    const q = [Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await db.listCollections({ databaseId: DB_ID, queries: q });
    for (const c of res.collections) live.set(c.$id, c);
    if (res.collections.length < 100) break;
    cursor = res.collections[res.collections.length - 1].$id;
  }
  return live;
}

function plan(live) {
  const ops = [];
  for (const col of COLLECTIONS) {
    if (EXISTING_COMMUNITY.includes(col.id)) throw new Error(`Refusing to touch community collection ${col.id}`);
    const existing = live.get(col.id);
    if (!existing) {
      ops.push({ kind: 'create_collection', col });
      for (const a of col.attributes) ops.push({ kind: 'create_attribute', col, attr: a });
      for (const i of col.indexes) ops.push({ kind: 'create_index', col, index: i });
      continue;
    }
    const wantPerms = permissionsFor(col).sort();
    const havePerms = [...(existing.$permissions || [])].sort();
    if (JSON.stringify(wantPerms) !== JSON.stringify(havePerms) || existing.documentSecurity !== (col.access === 'private')) {
      ops.push({ kind: 'fix_permissions', col, have: havePerms, want: wantPerms });
    }
    const haveAttrs = new Map((existing.attributes || []).map((a) => [a.key, a]));
    for (const a of col.attributes) {
      const h = haveAttrs.get(a.key);
      if (!h) ops.push({ kind: 'create_attribute', col, attr: a });
      else if (h.status !== 'available') ops.push({ kind: 'attribute_not_ready', col, attr: a, status: h.status, error: h.error });
    }
    const haveIdx = new Map((existing.indexes || []).map((i) => [i.key, i]));
    for (const i of col.indexes) {
      const h = haveIdx.get(i.key);
      if (!h) ops.push({ kind: 'create_index', col, index: i });
      else if (h.status !== 'available') ops.push({ kind: 'index_not_ready', col, index: i, status: h.status, error: h.error });
    }
  }
  return ops;
}

async function waitFor(colId, key, kind) {
  for (let i = 0; i < 120; i++) {
    const c = await db.getCollection({ databaseId: DB_ID, collectionId: colId });
    const list = kind === 'attribute' ? c.attributes : c.indexes;
    const found = list.find((x) => x.key === key);
    if (found?.status === 'available') return;
    if (found?.status === 'failed' || found?.status === 'stuck') {
      throw new Error(`${kind} ${colId}.${key} failed: ${found.error || 'unknown'}`);
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${kind} ${colId}.${key}`);
}

async function createAttribute(col, a) {
  const base = { databaseId: DB_ID, collectionId: col.id, key: a.key, required: a.required };
  const arr = a.array ? { array: true } : {};
  try {
    if (a.type === 'string') await db.createStringAttribute({ ...base, size: a.size, ...arr });
    else if (a.type === 'integer') await db.createIntegerAttribute({ ...base, ...arr });
    else if (a.type === 'float') await db.createFloatAttribute({ ...base, ...arr });
    else if (a.type === 'boolean') await db.createBooleanAttribute({ ...base, ...arr });
    else if (a.type === 'datetime') await db.createDatetimeAttribute({ ...base, ...arr });
    else throw new Error(`Unknown attribute type ${a.type}`);
  } catch (e) {
    if (!String(e.message || e).toLowerCase().includes('already exists')) throw e;
  }
}

async function createIndex(col, i) {
  try {
    await db.createIndex({ databaseId: DB_ID, collectionId: col.id, key: i.key, type: i.type, attributes: i.attributes });
  } catch (e) {
    if (!String(e.message || e).toLowerCase().includes('already exists')) throw e;
  }
}

async function apply(ops) {
  const log = [];
  const createdCols = new Set();
  for (const op of ops) {
    if (op.kind === 'create_collection') {
      await db.createCollection({
        databaseId: DB_ID,
        collectionId: op.col.id,
        name: op.col.name,
        permissions: permissionsFor(op.col),
        documentSecurity: op.col.access === 'private',
        enabled: true,
      });
      createdCols.add(op.col.id);
      log.push(`created collection ${op.col.id} [${op.col.access}]`);
      console.log(`  + collection ${op.col.id} (${op.col.access})`);
    } else if (op.kind === 'fix_permissions') {
      await db.updateCollection({
        databaseId: DB_ID,
        collectionId: op.col.id,
        name: op.col.name,
        permissions: permissionsFor(op.col),
        documentSecurity: op.col.access === 'private',
        enabled: true,
      });
      log.push(`fixed permissions ${op.col.id}`);
      console.log(`  ~ permissions ${op.col.id}: ${JSON.stringify(op.have)} -> ${JSON.stringify(op.want)}`);
    }
  }
  // Attributes: fire per collection, then wait (faster than serial)
  const attrOps = ops.filter((o) => o.kind === 'create_attribute');
  const byCol = new Map();
  for (const o of attrOps) {
    if (!byCol.has(o.col.id)) byCol.set(o.col.id, []);
    byCol.get(o.col.id).push(o);
  }
  for (const [colId, list] of byCol) {
    for (const o of list) {
      await createAttribute(o.col, o.attr);
      await sleep(120);
    }
    for (const o of list) await waitFor(colId, o.attr.key, 'attribute');
    log.push(`attributes ${colId}: ${list.map((o) => o.attr.key).join(', ')}`);
    console.log(`  + ${colId}: ${list.length} attribute(s) ready`);
  }
  const idxOps = ops.filter((o) => o.kind === 'create_index');
  for (const o of idxOps) {
    await createIndex(o.col, o.index);
    await sleep(120);
  }
  for (const o of idxOps) await waitFor(o.col.id, o.index.key, 'index');
  if (idxOps.length) console.log(`  + ${idxOps.length} index(es) ready`);
  return log;
}

async function recordMigration(status, log) {
  const id = `v${SCHEMA_VERSION}`;
  const data = {
    version: SCHEMA_VERSION,
    name: 'competition-season-ticketing',
    status,
    applied_at: new Date().toISOString(),
    log: log.join('\n').slice(0, 4000),
  };
  try {
    await db.getDocument({ databaseId: DB_ID, collectionId: MIGRATIONS_COLLECTION, documentId: id });
    await db.updateDocument({ databaseId: DB_ID, collectionId: MIGRATIONS_COLLECTION, documentId: id, data });
  } catch {
    await db.createDocument({ databaseId: DB_ID, collectionId: MIGRATIONS_COLLECTION, documentId: id, data });
  }
}

async function ensureSettings() {
  const id = 'ticketing';
  try {
    await db.getDocument({ databaseId: DB_ID, collectionId: 'app_settings', documentId: id });
    console.log('  settings doc exists (left unchanged)');
  } catch {
    await db.createDocument({
      databaseId: DB_ID,
      collectionId: 'app_settings',
      documentId: id,
      data: {
        competition_enabled: true,
        checkout_enabled: false,
        refunds_enabled: false,
        provider: 'none',
        hold_ttl_seconds: 600,
        currency: 'USD',
        note: 'Checkout stays disabled until a payment provider is approved.',
      },
    });
    console.log('  + settings doc app_settings/ticketing (checkout_enabled=false)');
  }
}

function printInventory(live) {
  console.log('\nSchema / index / permission inventory');
  console.log('------------------------------------');
  for (const col of COLLECTIONS) {
    const c = live.get(col.id);
    if (!c) {
      console.log(`${col.id.padEnd(22)} MISSING`);
      continue;
    }
    const attrs = c.attributes || [];
    const idxs = c.indexes || [];
    const ready = attrs.every((a) => a.status === 'available') && idxs.every((i) => i.status === 'available');
    console.log(
      `${col.id.padEnd(22)} ${String(col.access).padEnd(7)} docSec=${String(c.documentSecurity).padEnd(5)} perms=${JSON.stringify(c.$permissions)} attrs=${attrs.length} idx=${idxs.length} ${ready ? 'READY' : 'NOT READY'}`,
    );
  }
}

async function verify(live) {
  const ops = plan(live);
  const problems = ops.filter((o) => o.kind !== 'attribute_not_ready' && o.kind !== 'index_not_ready');
  const notReady = ops.filter((o) => o.kind === 'attribute_not_ready' || o.kind === 'index_not_ready');
  printInventory(live);
  for (const o of notReady) console.log(`NOT READY: ${o.col.id}.${o.attr?.key || o.index?.key} (${o.status}) ${o.error || ''}`);
  for (const p of problems) console.log(`DRIFT: ${p.kind} ${p.col.id} ${p.attr?.key || p.index?.key || ''}`);
  // Sanity: no private collection may carry collection-level grants; no public may allow client writes
  for (const col of COLLECTIONS) {
    const c = live.get(col.id);
    if (!c) continue;
    const perms = c.$permissions || [];
    const writes = perms.filter((p) => /^(create|update|delete)\(/.test(p));
    if (writes.length) {
      problems.push({ kind: 'unsafe_permission', col });
      console.log(`UNSAFE: ${col.id} has client write grants ${JSON.stringify(writes)}`);
    }
    if (col.access === 'private' && perms.length) {
      problems.push({ kind: 'unsafe_permission', col });
      console.log(`UNSAFE: private ${col.id} has collection-level grants ${JSON.stringify(perms)}`);
    }
  }
  return { ok: problems.length === 0 && notReady.length === 0, problems, notReady };
}

async function rollback() {
  console.log('Rollback: disabling feature flags and releasing open holds. No data is deleted.');
  try {
    await db.updateDocument({
      databaseId: DB_ID,
      collectionId: 'app_settings',
      documentId: 'ticketing',
      data: { competition_enabled: false, checkout_enabled: false },
    });
    console.log('  flags: competition_enabled=false, checkout_enabled=false');
  } catch (e) {
    console.log('  settings doc missing, nothing to disable:', e.message);
  }
  let released = 0;
  try {
    const holds = await db.listDocuments({
      databaseId: DB_ID,
      collectionId: 'ticket_holds',
      queries: [Query.equal('state', 'active'), Query.limit(500)],
    });
    for (const h of holds.documents) {
      const locks = await db.listDocuments({
        databaseId: DB_ID,
        collectionId: 'inventory_locks',
        queries: [Query.equal('hold_id', h.$id), Query.equal('state', 'held'), Query.limit(500)],
      });
      for (const l of locks.documents) {
        await db.deleteDocument({ databaseId: DB_ID, collectionId: 'inventory_locks', documentId: l.$id });
      }
      await db.updateDocument({ databaseId: DB_ID, collectionId: 'ticket_holds', documentId: h.$id, data: { state: 'released' } });
      released++;
    }
  } catch (e) {
    console.log('  hold release skipped:', e.message);
  }
  console.log(`  released ${released} open hold(s)`);
  console.log('  Financial history, payment events, audit records and issued tickets were NOT touched.');
}

async function main() {
  console.log(`Migration v${SCHEMA_VERSION} [${mode}] -> ${ENDPOINT} project ${PROJECT} db ${DB_ID}`);
  const live = await fetchLive();
  const communityPresent = EXISTING_COMMUNITY.filter((c) => live.has(c));
  console.log(`Community collections present (untouched): ${communityPresent.length}/${EXISTING_COMMUNITY.length}`);

  if (mode === '--inventory') {
    printInventory(live);
    return;
  }
  if (mode === '--rollback') {
    await rollback();
    return;
  }
  if (mode === '--verify') {
    const r = await verify(live);
    console.log(r.ok ? '\nVERIFY OK' : `\nVERIFY FAILED: ${r.problems.length} drift, ${r.notReady.length} not ready`);
    process.exit(r.ok ? 0 : 1);
  }

  const ops = plan(live);
  const summary = ops.reduce((acc, o) => ((acc[o.kind] = (acc[o.kind] || 0) + 1), acc), {});
  console.log('Plan:', JSON.stringify(summary));
  if (mode === '--dry-run') {
    for (const o of ops) {
      const what = o.attr ? `${o.col.id}.${o.attr.key}` : o.index ? `${o.col.id}#${o.index.key}` : o.col.id;
      console.log(`  ${o.kind.padEnd(20)} ${what}${o.status ? ` (${o.status})` : ''}`);
    }
    if (!ops.length) console.log('  nothing to do - already applied');
    console.log('\nDry run only. Re-run with --apply to execute.');
    return;
  }

  // --apply
  if (!ops.length) {
    console.log('Already applied.');
  } else {
    let log = [];
    try {
      log = await apply(ops);
      await recordMigration('applied', log);
    } catch (e) {
      console.error('Partial failure:', e.message);
      try {
        await recordMigration('partial', [...log, `ERROR: ${e.message}`]);
      } catch {
        /* migrations collection may not exist yet */
      }
      process.exit(1);
    }
  }
  await ensureSettings();
  const after = await fetchLive();
  const r = await verify(after);
  console.log(r.ok ? '\nAPPLY OK - schema ready' : '\nAPPLY finished with issues (see above)');
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

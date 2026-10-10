/**
 * Builds and deploys the `linkup-api` Appwrite Function (privileged server for competition + ticketing).
 *
 *   node scripts/deploy-function.mjs            # build, upload, activate, configure vars/scopes/schedule
 *   node scripts/deploy-function.mjs --no-build # reuse existing build
 *
 * Secrets (TICKET_SIGNING_SECRET, FAKE_PROVIDER_SECRET) are generated once and persisted to mobile/.env.
 */
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client, Functions } from 'node-appwrite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const fnDir = resolve(root, 'functions', 'linkup-api');
const FUNCTION_ID = 'linkup-api';

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
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://linkup-gold-gamma.vercel.app';
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'fake';
if (!API_KEY) {
  console.error('Missing APPWRITE_API_KEY in mobile/.env');
  process.exit(1);
}

function ensureSecret(name) {
  if (process.env[name]) return process.env[name];
  const value = randomBytes(32).toString('base64url');
  appendFileSync(resolve(root, '.env'), `\n${name}=${value}\n`);
  process.env[name] = value;
  console.log(`  generated ${name} and saved to mobile/.env`);
  return value;
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const functions = new Functions(client);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SCOPES = ['databases.read', 'collections.read', 'documents.read', 'documents.write', 'teams.read', 'users.read', 'messages.write', 'targets.read'];
const ENTRYPOINT = 'build/functions/linkup-api/src/main.js';
const COMMANDS = 'npm install --omit=dev';

async function build() {
  console.log('Building function (tsc)…');
  rmSync(resolve(fnDir, 'build'), { recursive: true, force: true });
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '-p', resolve(fnDir, 'tsconfig.json')], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error('tsc failed');
  const out = resolve(root, '.tmp');
  mkdirSync(out, { recursive: true });
  const tarPath = resolve(out, 'linkup-api.tar.gz');
  rmSync(tarPath, { force: true });
  const t = spawnSync('tar', ['--force-local', '-czf', tarPath, 'package.json', 'build'], { cwd: fnDir, stdio: 'inherit' });
  if (t.status !== 0) throw new Error('tar failed');
  console.log('  package:', tarPath, `${(readFileSync(tarPath).length / 1024).toFixed(1)} KB`);
  return tarPath;
}

async function ensureFunction() {
  const base = {
    functionId: FUNCTION_ID,
    name: 'LinkUp API (competition + ticketing)',
    runtime: 'node-22',
    execute: ['any'],
    timeout: 60,
    enabled: true,
    logging: true,
    entrypoint: ENTRYPOINT,
    commands: COMMANDS,
    scopes: SCOPES,
    schedule: '*/15 * * * *',
  };
  try {
    await functions.get({ functionId: FUNCTION_ID });
    await functions.update(base);
    console.log('  function updated');
  } catch (e) {
    if (e.code !== 404) throw e;
    await functions.create(base);
    console.log('  function created');
  }
}

async function upsertVars(vars) {
  const existing = await functions.listVariables({ functionId: FUNCTION_ID });
  for (const [key, value, secret] of vars) {
    const cur = existing.variables.find((v) => v.key === key);
    if (cur) {
      await functions.updateVariable({ functionId: FUNCTION_ID, variableId: cur.$id, key, value, secret: Boolean(secret) });
    } else {
      await functions.createVariable({ functionId: FUNCTION_ID, variableId: 'unique()', key, value, secret: Boolean(secret) });
    }
  }
  console.log(`  ${vars.length} variable(s) set: ${vars.map((v) => v[0]).join(', ')}`);
}

async function deploy(tarPath) {
  console.log('Uploading deployment…');
  const dep = await functions.createDeployment({
    functionId: FUNCTION_ID,
    code: new File([readFileSync(tarPath)], 'code.tar.gz'),
    activate: true,
    entrypoint: ENTRYPOINT,
    commands: COMMANDS,
  });
  console.log('  deployment', dep.$id);
  for (let i = 0; i < 120; i++) {
    const d = await functions.getDeployment({ functionId: FUNCTION_ID, deploymentId: dep.$id });
    if (d.status === 'ready') {
      console.log(`  build ready in ${d.buildDuration ?? '?'}s`);
      return d;
    }
    if (d.status === 'failed') {
      console.error('BUILD FAILED\n', d.buildLogs || d.buildOutput || '(no logs)');
      process.exit(1);
    }
    await sleep(3000);
  }
  throw new Error('Timeout waiting for build');
}

async function smoke() {
  const exec = await functions.createExecution({ functionId: FUNCTION_ID, xpath: '/health', method: 'GET' });
  console.log(`  smoke /health -> ${exec.responseStatusCode} ${exec.responseBody?.slice(0, 120)}`);
  const cfg = await functions.createExecution({ functionId: FUNCTION_ID, xpath: '/config', method: 'GET' });
  console.log(`  smoke /config -> ${cfg.responseStatusCode} ${cfg.responseBody?.slice(0, 200)}`);
  if (exec.responseStatusCode !== 200) {
    console.error('  logs:', exec.logs, exec.errors);
    process.exit(1);
  }
}

async function main() {
  console.log(`Deploy ${FUNCTION_ID} -> ${ENDPOINT} project ${PROJECT}`);
  const noBuild = process.argv.includes('--no-build');
  const tarPath = noBuild ? resolve(root, '.tmp', 'linkup-api.tar.gz') : await build();
  await ensureFunction();
  const ticketSecret = ensureSecret('TICKET_SIGNING_SECRET');
  const fakeSecret = ensureSecret('FAKE_PROVIDER_SECRET');
  await upsertVars([
    ['APPWRITE_DATABASE_ID', DB_ID],
    ['APP_ADMINS_TEAM_ID', 'app-admins'],
    ['APP_PUBLIC_URL', APP_PUBLIC_URL],
    ['PAYMENT_PROVIDER', PAYMENT_PROVIDER],
    ['PAYMENT_WINDOW_SECONDS', '900'],
    ['EMAIL_PROVIDER', process.env.EMAIL_PROVIDER || 'none'],
    ['TICKET_SIGNING_SECRET', ticketSecret, true],
    ['FAKE_PROVIDER_SECRET', fakeSecret, true],
  ]);
  await deploy(tarPath);
  await smoke();
  const fn = await functions.get({ functionId: FUNCTION_ID });
  console.log('\nDone. Function domain(s):', JSON.stringify(fn.domains ?? []));
  console.log(`Webhook path (for a provider, when approved): POST https://<function-domain>/payments/webhook`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

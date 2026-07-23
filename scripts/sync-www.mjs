import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'mobile/dist');
const www = resolve(root, 'www');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('Missing mobile/dist/index.html — run: cd mobile && npx expo export -p web');
  process.exit(1);
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(dist, www, { recursive: true });
console.log('Synced mobile/dist → www/');

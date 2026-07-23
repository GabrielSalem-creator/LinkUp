import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs with Vercel Root Directory = mobile (cannot read files outside mobile/)
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(mobileRoot, 'dist');
const out = resolve(mobileRoot, '.vercel-static');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('Missing mobile/dist/index.html');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true });
console.log('Vercel static ready:', out);

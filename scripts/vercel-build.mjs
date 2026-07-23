import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcWww = resolve(root, 'www');
const srcDist = resolve(root, 'mobile/dist');
const out = resolve(root, '.vercel-static');

const src = existsSync(resolve(srcWww, 'index.html'))
  ? srcWww
  : existsSync(resolve(srcDist, 'index.html'))
    ? srcDist
    : null;

if (!src) {
  console.error('No www/index.html or mobile/dist/index.html found');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });
console.log(`Vercel output ready from ${src} → ${out}`);

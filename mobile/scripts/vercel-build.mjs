import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Emit Vercel Build Output API so deep links (/my-clubs, etc.) hit index.html.
 * Root Directory for this project is `mobile`.
 */
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(mobileRoot, 'dist');
const outputRoot = resolve(mobileRoot, '.vercel/output');
const staticDir = resolve(outputRoot, 'static');

if (!existsSync(resolve(dist, 'index.html'))) {
  console.error('Missing mobile/dist/index.html — run: npx expo export -p web');
  process.exit(1);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(staticDir, { recursive: true });
cpSync(dist, staticDir, { recursive: true });

writeFileSync(
  resolve(outputRoot, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);

console.log('Vercel Build Output ready:', outputRoot);

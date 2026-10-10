import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = resolve(mobileRoot, 'dist', 'index.html');

if (!existsSync(indexPath)) {
  console.error('Missing dist/index.html');
  process.exit(1);
}

const shellStyle = `
<style id="linkup-shell">
html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}
html { background-color: #FFF2E2; }
body {
  overflow: hidden;
  background-color: #FFF2E2 !important;
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
}
#root {
  display: flex;
  flex: 1;
  min-height: 100%;
  min-height: 100dvh;
  background-color: #FFF2E2 !important;
}
#root > div {
  flex: 1;
  width: 100%;
  min-height: 100%;
  min-height: 100dvh;
}
@media (prefers-color-scheme: dark) {
  html, body, #root { background-color: #0C1A20 !important; }
}
</style>
<meta name="theme-color" content="#FFF2E2" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
`.trim();

let html = readFileSync(indexPath, 'utf8');

// Replace white-default body styling from expo-reset
html = html.replace(
  /body\s*\{\s*overflow:\s*hidden;\s*\}/,
  'body { overflow: hidden; background-color: #FFF2E2; }'
);

if (!html.includes('id="linkup-shell"')) {
  html = html.replace('</head>', `${shellStyle}\n</head>`);
}

writeFileSync(indexPath, html);
console.log('Patched dist/index.html with Côte Sport full-bleed shell');

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(resolve(root, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const res = await fetch(`${env.EXPO_PUBLIC_APPWRITE_ENDPOINT}/account/sessions/email`, {
  method: 'POST',
  headers: {
    'X-Appwrite-Project': env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: 'demo@linkup.app', password: 'LinkUpDemo123!' }),
});

console.log('status', res.status);
console.log('--- response headers ---');
for (const [k, v] of res.headers.entries()) {
  if (/cookie|session|fallback|set-/i.test(k) || /cookie|secret/i.test(v)) {
    console.log(k + ':', v.slice(0, 200));
  }
}
console.log('all header keys:', [...res.headers.keys()].join(', '));
const body = await res.json();
console.log('body keys', Object.keys(body));
console.log('secret in body?', Boolean(body.secret));
console.log('userId', body.userId);

/**
 * Post-build safety check: the browser bundle must never contain server-side secrets,
 * secret variable names, or provider API keys.   npm run check:bundle   (after `npm run build`)
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TEXT = new Set(['.js', '.css', '.html', '.json', '.xml', '.txt', '.map', '.webmanifest']);

const FORBIDDEN = [
  { name: 'RESEND_API_KEY', re: /RESEND_API_KEY/ },
  { name: 'TURNSTILE_SECRET_KEY', re: /TURNSTILE_SECRET_KEY/ },
  { name: 'GMAIL_APP_PASSWORD', re: /GMAIL_APP_PASSWORD/ },
  { name: 'SMTP server settings / nodemailer', re: /smtp\.gmail\.com|nodemailer/i },
  { name: 'Resend API key pattern (re_...)', re: /\bre_[A-Za-z0-9]{20,}\b/ },
  { name: 'Authorization bearer header', re: /Bearer\s+[A-Za-z0-9_-]{16,}/ },
  { name: 'server handler code', re: /quotation_email_failed|Idempotency-Key/ },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let scanned = 0;
const problems = [];
try {
  for await (const file of walk(dist)) {
    if (!TEXT.has(extname(file))) continue;
    scanned += 1;
    const body = await readFile(file, 'utf8');
    for (const { name, re } of FORBIDDEN) if (re.test(body)) problems.push(`${file.replace(dist, 'dist')}: contains ${name}`);
  }
} catch (err) {
  console.error('Could not read dist/. Run `npm run build` first.', err.message);
  process.exit(2);
}

if (problems.length) {
  console.error(`FAILED: secrets or server code found in the browser bundle:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: scanned ${scanned} text files in dist/ — no secrets or server-side code in the browser bundle.`);

/**
 * `npm run dev:mock` — run the site locally with a fake email provider so the complete
 * submit -> validate -> "send email" flow can be tried WITHOUT any credentials.
 * Captured messages are printed here and listed at http://127.0.0.1:4010/__emails .
 * Nothing is ever delivered to a real mailbox.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockResend } from './mock-resend-server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MOCK_RESEND_PORT) || 4010;
const mock = await startMockResend({ port });
console.log(`[mock-email] fake Resend API at ${mock.url}  (captured emails: ${mock.url}/__emails)`);

let seen = 0;
setInterval(() => {
  for (const mail of mock.emails().slice(seen)) {
    console.log(`[mock-email] captured: "${mail.subject}" -> ${[].concat(mail.to).join(', ')}`);
  }
  seen = mock.emails().length;
}, 500).unref();

const viteBin = resolve(root, 'node_modules/vite/bin/vite.js');
const child = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Preview mode must NEVER send real mail, even if a real .env exists: pin the fake provider and blank real credentials.
    MAIL_PROVIDER: 'resend',
    GMAIL_APP_PASSWORD: '',
    SMTP_HOST: '',
    SMTP_PORT: '',
    TURNSTILE_SECRET_KEY: '',
    RESEND_API_KEY: 'test_key',
    RESEND_API_URL: `${mock.url}/emails`,
    MAIL_FROM: 'Mock Sender <mock@example.test>',
    LEAD_TO_EMAIL: 'whiteelephantcreativestudio@gmail.com',
    SEND_CUSTOMER_CONFIRMATION: process.env.SEND_CUSTOMER_CONFIRMATION || 'false',
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '50',
  },
});
const stop = () => {
  child.kill();
  mock.close();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => {
  mock.close();
  process.exit(code ?? 0);
});

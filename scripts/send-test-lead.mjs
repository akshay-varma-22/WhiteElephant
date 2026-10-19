/**
 * Send ONE clearly-labelled test lead, to prove real email delivery.
 *
 *   npm run send-test-lead -- --direct
 *       Runs the real lead pipeline in this terminal using the values in your local `.env` and the REAL mail
 *       service: Gmail (GMAIL_USER + GMAIL_APP_PASSWORD) or Resend (RESEND_API_KEY + MAIL_FROM), plus LEAD_TO_EMAIL.
 *       Use this first, to verify your credentials and inbox BEFORE deploying.
 *
 *   npm run send-test-lead -- --url https://www.whiteelephantcreativestudio.com
 *       Posts the same test lead to a deployed site's /api/quotation endpoint, verifying the
 *       Netlify environment variables. (If you enabled the Turnstile CAPTCHA, this mode is rejected
 *       by design; use --direct, or test through the website form in a browser.)
 *
 * The lead is named "Website Test Lead" and uses the studio's own first phone number, so it is easy to recognise and ignore.
 * It contains no real customer data. It WILL land in the studio inbox when it succeeds.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUSINESS } from '../shared/business.js';
import { resolveMail } from '../server/mail.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const payload = {
  name: 'Website Test Lead',
  phone: BUSINESS.phones[0].display,
  email: BUSINESS.email, // the form requires an email address; the studio's own address stands in for the customer's
  submissionId: randomUUID(),
};

function explain(code, status) {
  const hints = {
    missing_api_key: 'RESEND_API_KEY is missing or empty.',
    restricted_api_key: 'The API key can only send; this is expected to work. Check the key value.',
    smtp_auth_failed:
      'Google rejected the login. Use an App Password, NOT your normal Gmail password: turn on 2-Step Verification, then create one at https://myaccount.google.com/apppasswords. Check GMAIL_USER is that same account. Changing your Google password revokes existing app passwords.',
    smtp_quota_exceeded: 'Gmail daily sending limit reached (about 500 messages per rolling 24 hours for a regular account). Try again later.',
    smtp_connection_failed: 'Could not connect to the mail server (smtp.gmail.com port 465). Check your internet connection, and whether a firewall, antivirus or VPN is blocking port 465.',
    smtp_rejected: 'The mail server refused the message or a recipient. Check LEAD_TO_EMAIL is a valid address.',
    smtp_temporary_failure: 'The mail server asked to try again later. Wait a few minutes and retry.',
    smtp_bad_message: 'The message could not be built. Check LEAD_TO_EMAIL and GMAIL_USER are valid addresses.',
    validation_error:
      status === 403
        ? 'Resend refused the sender or recipient. Without a verified domain you can only send to the email address that owns your Resend account, from onboarding@resend.dev. Verify your domain in Resend (Domains) and set MAIL_FROM to an address on it, or set LEAD_TO_EMAIL to your Resend account email for testing.'
        : 'Resend rejected the message fields (check MAIL_FROM format: Name <address@domain>).',
    daily_quota_exceeded: 'Resend daily sending quota reached (resets 00:00 UTC).',
    monthly_quota_exceeded: 'Resend monthly sending quota reached.',
    network_error: 'Could not reach api.resend.com from this machine.',
    timeout: 'Resend did not answer in time.',
  };
  return hints[code] ?? 'See https://resend.com/docs/api-reference/errors for this error name.';
}

async function runDirect() {
  const envFile = resolve(root, '.env');
  if (!existsSync(envFile)) {
    console.error('No .env file found. Copy .env.example to .env and fill in RESEND_API_KEY first.');
    process.exit(2);
  }
  process.loadEnvFile(envFile);
  const env = { ...process.env, TURNSTILE_SECRET_KEY: '' };
  const mail = resolveMail(env);
  if (mail.missing.length) {
    console.error(
      mail.provider === 'gmail'
        ? 'GMAIL_APP_PASSWORD is empty in .env (create an App Password at https://myaccount.google.com/apppasswords).'
        : 'RESEND_API_KEY is empty in .env. (To use Gmail instead, set MAIL_PROVIDER=gmail and GMAIL_APP_PASSWORD.)',
    );
    process.exit(2);
  }
  const { createQuotationHandler } = await import('../server/handler.js');
  let failure = null;
  const handler = createQuotationHandler({
    logger: {
      info: () => {},
      warn: () => {},
      error: (event, meta) => {
        failure = { event, ...meta };
      },
    },
  });
  const to = env.LEAD_TO_EMAIL || BUSINESS.email;
  console.log(
    mail.provider === 'gmail'
      ? `Sending a test lead to ${to} through Gmail SMTP as ${env.GMAIL_USER || BUSINESS.email} ...`
      : `Sending a test lead to ${to} via Resend from "${env.MAIL_FROM || 'onboarding@resend.dev'}" ...`,
  );
  const response = await handler(
    new Request('http://localhost/api/quotation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    { env, ip: '127.0.0.1' },
  );
  const body = await response.json();
  if (response.status === 200 && body.ok) {
    console.log(`\nSUCCESS: ${mail.provider === 'gmail' ? 'Gmail' : 'Resend'} accepted the message (reference ${body.reference}).`);
    console.log(`Now open the inbox for ${to} (check Spam/Promotions too) and confirm the email "New Quotation Lead — Website Test Lead — Custom Design Solutions" arrived.`);
    console.log(
      mail.provider === 'gmail'
        ? 'Acceptance by Gmail is not the same as arrival: confirm the message is in the inbox (check Spam). If you sent to the same Gmail account, it also appears under Sent.'
        : 'Acceptance by Resend is not the same as inbox delivery: confirm arrival yourself, and check https://resend.com/emails for the delivery status.',
    );
    return;
  }
  console.error(`\nFAILED (HTTP ${response.status}): ${JSON.stringify(body)}`);
  if (failure?.providerCode) console.error(`Mail service said: ${failure.providerCode} (status ${failure.providerStatus}). ${explain(failure.providerCode, failure.providerStatus)}`);
  process.exit(1);
}

async function runRemote(url) {
  const endpoint = new URL('/api/quotation', url).toString();
  console.log(`Posting a test lead to ${endpoint} ...`);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  if (res.ok && body.ok) {
    console.log(`\nSUCCESS: the deployed site accepted the lead (reference ${body.reference}). Confirm it arrived in the studio inbox.`);
    return;
  }
  console.error(`\nFAILED (HTTP ${res.status}): ${JSON.stringify(body)}`);
  const hints = {
    not_configured: 'Mail settings are missing in Netlify (GMAIL_APP_PASSWORD, or RESEND_API_KEY) — Site configuration > Environment variables. Redeploy after adding them.',
    email_failed: 'The site reached the mail service but it refused the email. Run with --direct locally for the exact reason, and check the Netlify function logs.',
    captcha_failed: 'The site requires the Turnstile CAPTCHA; use the website form in a browser, or --direct.',
    rate_limited: 'Too many requests; wait a few minutes.',
  };
  if (hints[body.code]) console.error(hints[body.code]);
  process.exit(1);
}

if (flag('--direct')) await runDirect();
else if (value('--url')) await runRemote(value('--url'));
else {
  console.log('Usage:\n  npm run send-test-lead -- --direct\n  npm run send-test-lead -- --url https://www.whiteelephantcreativestudio.com');
  process.exit(2);
}

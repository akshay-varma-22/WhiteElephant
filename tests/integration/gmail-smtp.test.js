/**
 * Real SMTP conversations: the actual lead handler -> actual Nodemailer -> a real SMTP server listening on
 * localhost (smtp-server). Proves the Gmail-style path works at protocol level (AUTH, envelope, MIME, UTF-8,
 * rejections, dead connections). It cannot prove Google accepts YOUR app password: that needs the owner's
 * credentials (npm run send-test-lead -- --direct).
 */
import net from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';
import { createQuotationHandler } from '../../server/handler.js';
import { createRateLimiter } from '../../server/rate-limit.js';
import { createSmtpMailer } from '../../server/smtp-mailer.js';
import { NOW, validPayload } from '../fixtures.js';

const USER = 'studio@example.test';
const PASSWORD = 'abcdefghijklmnop';
const SPACED_PASSWORD = 'abcd efgh ijkl mnop'; // how Google displays app passwords

let server;
let port;
let received;
let authAttempts;
let rejectRecipients;

function startServer() {
  return new Promise((resolve) => {
    server = new SMTPServer({
      authOptional: false,
      allowInsecureAuth: true,
      disabledCommands: ['STARTTLS'],
      logger: false,
      onAuth(auth, _session, cb) {
        authAttempts.push({ user: auth.username, pass: auth.password });
        if (auth.username === USER && auth.password === PASSWORD) return cb(null, { user: auth.username });
        return cb(Object.assign(new Error('535 5.7.8 Username and Password not accepted'), { responseCode: 535 }));
      },
      onRcptTo(address, _session, cb) {
        if (rejectRecipients.has(address.address)) {
          return cb(Object.assign(new Error('550 5.1.1 Mailbox unavailable'), { responseCode: 550 }));
        }
        return cb();
      },
      onData(stream, session, cb) {
        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          received.push({ raw: Buffer.concat(chunks), envelope: session.envelope });
          cb();
        });
      },
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.server.address().port;
      resolve();
    });
  });
}

/** A TCP port with nothing listening on it. */
function closedPort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

beforeAll(startServer);
afterAll(() => new Promise((r) => server.close(r)));
beforeEach(() => {
  received = [];
  authAttempts = [];
  rejectRecipients = new Set();
});

const env = (over = {}) => ({
  MAIL_PROVIDER: 'gmail',
  GMAIL_USER: USER,
  GMAIL_APP_PASSWORD: SPACED_PASSWORD,
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(port),
  SMTP_SECURE: 'false',
  LEAD_TO_EMAIL: 'inbox@example.test',
  ...over,
});

function makeHandler() {
  const logs = [];
  const logger = { info: (e, m) => logs.push({ e, ...m }), warn: (e, m) => logs.push({ e, ...m }), error: (e, m) => logs.push({ e, ...m }) };
  const handler = createQuotationHandler({
    logger,
    now: () => NOW,
    rateLimiter: createRateLimiter({ max: 1000 }),
    smtpMailer: createSmtpMailer({ sleep: async () => {} }),
  });
  return { handler, logs };
}

const post = (handler, payload, e = env(), ip = '198.51.100.20') =>
  handler(
    new Request('https://site.test/api/quotation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://site.test' },
      body: JSON.stringify(payload),
    }),
    { env: e, ip },
  );

describe('Gmail-style SMTP delivery over a real connection', () => {
  it('delivers a complete, correctly formed lead email', async () => {
    const { handler } = makeHandler();
    const res = await post(
      handler,
      validPayload({
        name: 'Asha Rao',
        email: 'asha@example.com',
        submissionId: 'smtp-test-0001',
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.demo).toBe(true); // a local test server, not real Gmail

    expect(received).toHaveLength(1);
    const mail = await simpleParser(received[0].raw);

    // Authentication used the account + the app password with its spaces removed.
    expect(authAttempts).toEqual([{ user: USER, pass: PASSWORD }]);
    // Envelope and headers
    expect(received[0].envelope.mailFrom.address).toBe(USER);
    expect(received[0].envelope.rcptTo.map((r) => r.address)).toEqual(['inbox@example.test']);
    expect(mail.from.value[0]).toMatchObject({ address: USER, name: 'White Elephant Creative Studio Website' });
    expect(mail.to.value[0].address).toBe('inbox@example.test');
    expect(mail.replyTo.value[0].address).toBe('asha@example.com');
    expect(mail.subject).toBe('New Quotation Lead — Asha Rao — +91 99496 21569');
    expect(mail.messageId).toMatch(/^<wecs-[0-9a-f]{48}@whiteelephantcreativestudio\.com>$/);
    // Both plain-text and HTML parts, with every detail the form collects
    expect(mail.text).toContain('Name: Asha Rao');
    expect(mail.text).toContain('Phone: +91 99496 21569');
    expect(mail.text).toContain('Email: asha@example.com');
    expect(mail.text).toContain('Received: Thursday, 15 October 2026, 2:00 PM IST');
    expect(mail.html).toContain('href="tel:+919949621569"');
  });

  it('keeps non-ASCII text intact end to end', async () => {
    const { handler } = makeHandler();
    await post(handler, validPayload({ name: 'Śrīnivās Rao' }));
    const mail = await simpleParser(received[0].raw);
    expect(mail.subject).toContain('Śrīnivās Rao');
    expect(mail.text).toContain('Name: Śrīnivās Rao');
    await post(handler, validPayload({ name: 'శ్రీనివాస్ రావు', submissionId: 'smtp-test-0002' }));
    const second = await simpleParser(received[1].raw);
    expect(second.text).toContain('Name: శ్రీనివాస్ రావు');
  });

  it('sends to every comma-separated recipient', async () => {
    const { handler } = makeHandler();
    await post(handler, validPayload(), env({ LEAD_TO_EMAIL: 'a@example.test, b@example.test' }));
    expect(received[0].envelope.rcptTo.map((r) => r.address).sort()).toEqual(['a@example.test', 'b@example.test']);
  });

  it('sends a minimal acknowledgement to the customer when enabled, from the same account', async () => {
    const { handler } = makeHandler();
    const res = await post(
      handler,
      validPayload({ email: 'customer@example.com' }),
      env({ SEND_CUSTOMER_CONFIRMATION: 'true' }),
    );
    expect(res.status).toBe(200);
    expect(received).toHaveLength(2);
    const ack = await simpleParser(received[1].raw);
    expect(ack.to.value[0].address).toBe('customer@example.com');
    expect(ack.from.value[0].address).toBe(USER);
    expect(ack.replyTo.value[0].address).toBe('inbox@example.test');
    expect(ack.text).toContain('Hello Test Customer,');
    expect(ack.text).not.toContain('+919949621569');
  });

  it('still reports success if only the customer acknowledgement is rejected', async () => {
    rejectRecipients.add('customer@example.com');
    const { handler, logs } = makeHandler();
    const res = await post(handler, validPayload({ email: 'customer@example.com' }), env({ SEND_CUSTOMER_CONFIRMATION: 'true' }));
    expect(res.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(logs.some((l) => l.e === 'quotation_ack_failed')).toBe(true);
  });
});

describe('failures are reported as failures — never as success', () => {
  it('wrong app password -> error, nothing delivered, no secrets or personal data logged', async () => {
    const { handler, logs } = makeHandler();
    const res = await post(
      handler,
      validPayload({ name: 'Private Person', email: 'private.person@example.com', phone: '98765 43210' }),
      env({ GMAIL_APP_PASSWORD: 'wrongwrongwrongx' }),
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, code: 'email_failed' });
    expect(received).toHaveLength(0);

    const failure = logs.find((l) => l.e === 'quotation_email_failed');
    expect(failure).toMatchObject({ provider: 'gmail', providerCode: 'smtp_auth_failed', providerStatus: 535 });
    const logged = JSON.stringify(logs);
    for (const secret of ['wrongwrongwrongx', PASSWORD, 'Private Person', 'private.person@example.com', '98765', USER]) {
      expect(logged).not.toContain(secret);
    }
  });

  it('recipient refused by the server -> error', async () => {
    rejectRecipients.add('inbox@example.test');
    const { handler, logs } = makeHandler();
    const res = await post(handler, validPayload());
    expect(res.status).toBe(502);
    expect(received).toHaveLength(0);
    expect(logs.find((l) => l.e === 'quotation_email_failed').providerCode).toMatch(/^smtp_(rejected|bad_message)$/);
  });

  it('mail server unreachable -> error (after one safe retry)', async () => {
    const { handler, logs } = makeHandler();
    const res = await post(handler, validPayload(), env({ SMTP_PORT: String(await closedPort()) }));
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
    expect(logs.find((l) => l.e === 'quotation_email_failed').providerCode).toBe('smtp_connection_failed');
  });

  it('missing app password -> "not configured", nothing attempted', async () => {
    const { handler, logs } = makeHandler();
    const res = await post(handler, validPayload(), env({ GMAIL_APP_PASSWORD: '' }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(authAttempts).toHaveLength(0);
    expect(logs.find((l) => l.e === 'quotation_not_configured')).toMatchObject({ provider: 'gmail', missing: ['GMAIL_APP_PASSWORD'] });
  });
});

describe('duplicate protection', () => {
  it('an identical retry (same submission) delivers only one email', async () => {
    const { handler } = makeHandler();
    const payload = validPayload({ submissionId: 'dedupe-0000001' });
    const a = await post(handler, payload);
    const b = await post(handler, payload);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(received).toHaveLength(1);
  });

  it('edited content or a new submission is delivered', async () => {
    const { handler } = makeHandler();
    await post(handler, validPayload({ submissionId: 'dedupe-0000002' }));
    await post(handler, validPayload({ submissionId: 'dedupe-0000002', name: 'Changed Name' }));
    await post(handler, validPayload({ submissionId: 'dedupe-0000003' }));
    expect(received).toHaveLength(3);
  });

  it('a failed attempt does not block a later retry', async () => {
    const { handler } = makeHandler();
    const payload = validPayload({ submissionId: 'dedupe-0000004' });
    expect((await post(handler, payload, env({ GMAIL_APP_PASSWORD: 'wrongwrongwrongx' }))).status).toBe(502);
    expect((await post(handler, payload)).status).toBe(200);
    expect(received).toHaveLength(1);
  });
});

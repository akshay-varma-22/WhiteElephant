import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuotationHandler } from '../../server/handler.js';
import { createRateLimiter } from '../../server/rate-limit.js';
import { NOW, validPayload } from '../fixtures.js';

const SITE = 'https://site.test';
const RESEND = 'https://api.resend.com/emails';
const TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const baseEnv = { RESEND_API_KEY: 're_test_key', MAIL_FROM: 'Leads <leads@example.test>' };

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function request(body, { method = 'POST', headers = {}, raw } = {}) {
  return new Request(`${SITE}/api/quotation`, {
    method,
    headers: { 'content-type': 'application/json', origin: SITE, ...headers },
    body: method === 'GET' ? undefined : (raw ?? JSON.stringify(body)),
  });
}

function setup({ providerResponses, rate } = {}) {
  const calls = [];
  const queue = [...(providerResponses ?? [])];
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === TURNSTILE) return jsonResponse(200, { success: true });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? jsonResponse(200, { id: 'email_123' });
  });
  const logs = [];
  const logger = {
    info: (e, m) => logs.push({ level: 'info', e, ...m }),
    warn: (e, m) => logs.push({ level: 'warn', e, ...m }),
    error: (e, m) => logs.push({ level: 'error', e, ...m }),
  };
  const handler = createQuotationHandler({
    fetchImpl,
    logger,
    now: () => NOW,
    sleep: async () => {},
    rateLimiter: rate ?? createRateLimiter({ max: 100 }),
  });
  const resendCalls = () => calls.filter((c) => c.url === RESEND);
  const sentBody = (i = 0) => JSON.parse(resendCalls()[i].init.body);
  return { handler, fetchImpl, calls, logs, resendCalls, sentBody };
}

const send = (h, payload, ctx = {}, opts) => h.handler(request(payload, opts), { env: baseEnv, ip: '203.0.113.7', ...ctx });

describe('successful submission', () => {
  it('sends the lead to the studio inbox through the provider and reports success only afterwards', async () => {
    const h = setup();
    const res = await send(h, validPayload({ name: 'Asha Rao', submissionId: 'sub-12345678' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.reference).toMatch(/^WE-[0-9A-F]{6}$/);
    expect(h.resendCalls()).toHaveLength(1);

    const call = h.resendCalls()[0];
    expect(call.init.headers.Authorization).toBe('Bearer re_test_key');
    expect(call.init.headers['Idempotency-Key']).toMatch(/^wecs-/);

    const body = h.sentBody();
    expect(body.to).toEqual(['whiteelephantcreativestudio@gmail.com']);
    expect(body.from).toBe('Leads <leads@example.test>');
    expect(body.subject).toBe('New Quotation Lead — Asha Rao — +91 99496 21569');
    expect(body.html).toContain('Asha Rao');
    expect(body.html).toContain('+91 99496 21569');
    expect(body.text).toContain('Phone: +91 99496 21569');
    expect(body.reply_to).toEqual(['test.customer@example.com']); // the customer's email, which every enquiry now has
    expect(body.text).toContain('Email: test.customer@example.com');
  });

  it('uses LEAD_TO_EMAIL when configured (changing the destination)', async () => {
    const h = setup();
    await h.handler(request(validPayload()), { env: { ...baseEnv, LEAD_TO_EMAIL: 'owner@example.test' }, ip: '1.1.1.1' });
    expect(h.sentBody().to).toEqual(['owner@example.test']);
  });

  it('delivers to several comma-separated recipients', async () => {
    const h = setup();
    await h.handler(request(validPayload()), { env: { ...baseEnv, LEAD_TO_EMAIL: 'a@example.test, b@example.test ' }, ip: '1.1.1.1' });
    expect(h.sentBody().to).toEqual(['a@example.test', 'b@example.test']);
  });

  it('refuses to run (and sends nothing) when LEAD_TO_EMAIL has no valid address', async () => {
    const h = setup();
    const res = await h.handler(request(validPayload()), { env: { ...baseEnv, LEAD_TO_EMAIL: 'not-an-email' }, ip: '1.1.1.1' });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('sets reply_to to the customer’s email address, so replying to the lead reaches them', async () => {
    const h = setup();
    await send(h, validPayload({ email: 'customer@example.com' }));
    expect(h.sentBody().reply_to).toEqual(['customer@example.com']);
  });

  it('stamps the lead with the time it was received (IST)', async () => {
    const h = setup();
    await send(h, validPayload());
    const { html, text } = h.sentBody();
    for (const body of [html, text]) expect(body).toContain('Thursday, 15 October 2026, 2:00 PM IST');
  });

  it('sends a lead that has only a name, a number and an email, and ignores any other fields', async () => {
    const h = setup();
    const res = await send(h, {
      name: 'Asha Rao',
      phone: '99496 21569',
      email: 'asha@example.com',
      services: ['architecture'],
      description: 'SHOULD NOT APPEAR',
      consent: false,
    });
    expect(res.status).toBe(200);
    const { html, text } = h.sentBody();
    expect(text).not.toContain('SHOULD NOT APPEAR');
    expect(html).not.toContain('SHOULD NOT APPEAR');
    expect(text).toContain('Email: asha@example.com');
  });

  it('produces the same idempotency key for an identical retry and a new one for edited content', async () => {
    const h = setup();
    await send(h, validPayload({ submissionId: 'submission-aaaa1111' }));
    await send(h, validPayload({ submissionId: 'submission-aaaa1111' }));
    await send(h, validPayload({ submissionId: 'submission-aaaa1111', name: 'Edited Name' }));
    await send(h, validPayload({ submissionId: 'submission-bbbb2222' }));
    const keys = h.resendCalls().map((c) => c.init.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[3]).not.toBe(keys[0]);
  });
});

describe('server-side validation', () => {
  it('rejects invalid data with field errors and never contacts the provider', async () => {
    const h = setup();
    const res = await send(h, validPayload({ name: '', phone: '123' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_error');
    expect(Object.keys(data.errors).sort()).toEqual(['name', 'phone']);
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('rejects a bad email address and a missing one: the email is required', async () => {
    const h = setup();
    for (const email of ['not-an-email', '', undefined]) {
      const res = await send(h, validPayload({ email }));
      expect(res.status, String(email)).toBe(400);
      expect(Object.keys((await res.json()).errors), String(email)).toEqual(['email']);
    }
    expect(h.resendCalls()).toHaveLength(0);
  });
});

describe('failure handling (scenarios 12-13)', () => {
  it('returns an error — never success — when the provider fails with a server error (retrying once)', async () => {
    const h = setup({ providerResponses: [jsonResponse(500, { name: 'application_error' }), jsonResponse(500, { name: 'application_error' })] });
    const res = await send(h, validPayload());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, code: 'email_failed' });
    expect(h.resendCalls()).toHaveLength(2);
  });

  it('succeeds when the single retry succeeds, using the same idempotency key', async () => {
    const h = setup({ providerResponses: [jsonResponse(503, { name: 'service_unavailable' })] });
    const res = await send(h, validPayload({ submissionId: 'submission-retry01' }));
    expect(res.status).toBe(200);
    expect(h.resendCalls()).toHaveLength(2);
    expect(h.resendCalls()[0].init.headers['Idempotency-Key']).toBe(h.resendCalls()[1].init.headers['Idempotency-Key']);
  });

  it.each([
    [401, 'missing_api_key'],
    [403, 'validation_error'],
    [422, 'missing_required_field'],
    [429, 'daily_quota_exceeded'],
  ])('does not retry a %i provider rejection and reports failure', async (status, name) => {
    const h = setup({ providerResponses: [jsonResponse(status, { name, message: 'x' })] });
    const res = await send(h, validPayload());
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
    expect(h.resendCalls()).toHaveLength(1);
  });

  it('reports failure when the provider cannot be reached', async () => {
    const h = setup({ providerResponses: [new TypeError('fetch failed'), new TypeError('fetch failed')] });
    const res = await send(h, validPayload());
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });

  it('reports "not configured" when the API key is missing', async () => {
    const h = setup();
    const res = await h.handler(request(validPayload()), { env: {}, ip: '1.1.1.1' });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('logs failures without customer data or credentials', async () => {
    const h = setup({ providerResponses: [jsonResponse(403, { name: 'validation_error', message: 'cannot send to secret.customer@example.com' })] });
    await send(h, validPayload({ name: 'Private Person', email: 'secret.customer@example.com', phone: '98765 43210', description: 'confidential details' }));
    const logged = JSON.stringify(h.logs);
    expect(logged).toContain('quotation_email_failed');
    expect(logged).toContain('"providerStatus":403');
    for (const secret of ['Private Person', 'secret.customer@example.com', '98765', 'confidential', 're_test_key']) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe('spam protection and request hygiene', () => {
  it('silently drops honeypot submissions without sending email', async () => {
    const h = setup();
    const res = await send(h, validPayload({ company_website: 'http://spam.example' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('rate-limits repeated requests from one IP', async () => {
    const h = setup({ rate: createRateLimiter({ max: 3 }) });
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await send(h, validPayload({ submissionId: `submission-${i}0000000` }))).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    const limited = await send(h, validPayload());
    expect(limited.headers.get('Retry-After')).toBeTruthy();
  });

  it('rate-limits each IP separately', async () => {
    const h = setup({ rate: createRateLimiter({ max: 1 }) });
    expect((await send(h, validPayload(), { ip: '198.51.100.1' })).status).toBe(200);
    expect((await send(h, validPayload(), { ip: '198.51.100.2' })).status).toBe(200);
    expect((await send(h, validPayload(), { ip: '198.51.100.1' })).status).toBe(429);
  });

  it('only accepts POST', async () => {
    const h = setup();
    const res = await h.handler(request(null, { method: 'GET' }), { env: baseEnv });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it('requires a JSON content type', async () => {
    const h = setup();
    const res = await send(h, null, {}, { headers: { 'content-type': 'text/plain' }, raw: 'hello' });
    expect(res.status).toBe(415);
  });

  it('rejects malformed JSON and non-object JSON', async () => {
    const h = setup();
    expect((await send(h, null, {}, { raw: '{not json' })).status).toBe(400);
    expect((await send(h, null, {}, { raw: '[1,2,3]' })).status).toBe(400);
  });

  it('rejects oversized bodies', async () => {
    const h = setup();
    const res = await send(h, null, {}, { raw: JSON.stringify({ description: 'x'.repeat(40_000) }) });
    expect(res.status).toBe(413);
  });

  it('rejects cross-site browser requests but allows configured origins', async () => {
    const h = setup();
    const evil = await send(h, validPayload(), {}, { headers: { origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
    expect(h.resendCalls()).toHaveLength(0);

    const allowed = await h.handler(request(validPayload(), { headers: { origin: 'https://www.partner.test' } }), {
      env: { ...baseEnv, ALLOWED_ORIGINS: 'https://www.partner.test' },
      ip: '9.9.9.9',
    });
    expect(allowed.status).toBe(200);
  });

  it('does not crash on hostile JSON values', async () => {
    const h = setup();
    const res = await send(h, null, {}, { raw: JSON.stringify({ name: { toString: 1 }, services: { a: 1 }, phone: ['x'], consent: 'yes' }) });
    expect(res.status).toBe(400);
  });
});

describe('optional Turnstile CAPTCHA', () => {
  const env = { ...baseEnv, TURNSTILE_SECRET_KEY: 'secret' };

  it('requires a token when configured', async () => {
    const h = setup();
    const res = await h.handler(request(validPayload()), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('captcha_failed');
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('sends the lead when Cloudflare confirms the token', async () => {
    const h = setup();
    const res = await h.handler(request(validPayload({ turnstileToken: 'tok' })), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(200);
    expect(h.calls.some((c) => c.url === TURNSTILE)).toBe(true);
  });

  it('rejects a token Cloudflare refuses', async () => {
    const h = setup();
    h.fetchImpl.mockImplementationOnce(async () => jsonResponse(200, { success: false, 'error-codes': ['invalid-input-response'] }));
    const res = await h.handler(request(validPayload({ turnstileToken: 'bad' })), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(400);
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('reports a temporary error when Cloudflare is unreachable', async () => {
    const h = setup();
    h.fetchImpl.mockImplementationOnce(async () => {
      throw new TypeError('network');
    });
    const res = await h.handler(request(validPayload({ turnstileToken: 'tok' })), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(503);
  });
});

describe('optional customer acknowledgement', () => {
  const env = { ...baseEnv, SEND_CUSTOMER_CONFIRMATION: 'true' };

  it('is off by default', async () => {
    const h = setup();
    await send(h, validPayload({ email: 'customer@example.com' }));
    expect(h.resendCalls()).toHaveLength(1);
  });

  it('sends a minimal acknowledgement (no promised timeline) after the lead is accepted', async () => {
    const h = setup();
    await h.handler(request(validPayload({ email: 'customer@example.com', description: 'PRIVATE-FREE-TEXT' })), { env, ip: '1.1.1.1' });
    expect(h.resendCalls()).toHaveLength(2);
    const ack = h.sentBody(1);
    expect(ack.to).toEqual(['customer@example.com']);
    expect(ack.reply_to).toEqual(['whiteelephantcreativestudio@gmail.com']);
    expect(ack.text).toContain('Hello Test Customer,');
    expect(ack.text).not.toMatch(/within \d+|hours|business days|24/i);
    expect(ack.text).not.toContain('PRIVATE-FREE-TEXT');
  });

  it('cannot be skipped for want of an email: an enquiry without one is refused, so nothing is sent at all', async () => {
    const h = setup();
    const res = await h.handler(request(validPayload({ email: '' })), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(400);
    expect(h.resendCalls()).toHaveLength(0);
  });

  it('never turns a delivered lead into an error if the acknowledgement fails', async () => {
    const h = setup({ providerResponses: [jsonResponse(200, { id: 'lead' }), jsonResponse(403, { name: 'validation_error' })] });
    const res = await h.handler(request(validPayload({ email: 'customer@example.com' })), { env, ip: '1.1.1.1' });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(h.logs.some((l) => l.e === 'quotation_ack_failed')).toBe(true);
  });
});

describe('preview-mode flag', () => {
  it('tells the browser when leads go to a local test inbox, and only then', async () => {
    const local = setup();
    const a = await local.handler(request(validPayload()), { env: { ...baseEnv, RESEND_API_URL: 'http://127.0.0.1:4010/emails' }, ip: '5.5.5.5' });
    expect((await a.json()).demo).toBe(true);

    const real = setup();
    const b = await real.handler(request(validPayload()), { env: baseEnv, ip: '5.5.5.6' });
    expect((await b.json()).demo).toBeUndefined();

    const explicitReal = setup();
    const c = await explicitReal.handler(request(validPayload()), { env: { ...baseEnv, RESEND_API_URL: 'https://api.resend.com/emails' }, ip: '5.5.5.7' });
    expect((await c.json()).demo).toBeUndefined();
  });
});

describe('RESEND_API_URL override (used by the local mock provider)', () => {
  let h;
  beforeEach(() => {
    h = setup();
  });
  it('posts to the overridden URL', async () => {
    await h.handler(request(validPayload()), { env: { ...baseEnv, RESEND_API_URL: 'http://127.0.0.1:4010/emails' }, ip: '1.1.1.1' });
    expect(h.calls[0].url).toBe('http://127.0.0.1:4010/emails');
  });
});

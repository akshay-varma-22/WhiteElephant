/**
 * Framework-agnostic quotation endpoint.
 *
 * Takes a standard Web `Request`, returns a standard Web `Response`, so the same code
 * runs as a Netlify Function, in the Vite dev/preview server, and inside unit tests.
 *
 * Pipeline: method → origin → content-type/size → JSON → rate limit → honeypot →
 *           captcha (optional) → server-side validation → send email → (optional) acknowledgement.
 *
 * Email is delivered by Gmail SMTP (App Password) or Resend, chosen in server/mail.js.
 * Success (`{ ok: true }`) is returned ONLY after the mail provider has accepted the message.
 * Logs never contain customer data or secrets: only event names, status codes and request ids.
 */
import { createHash, randomUUID } from 'node:crypto';
import { BUSINESS } from '../shared/business.js';
import { HONEYPOT_FIELD } from '../shared/quotation-options.js';
import { isValidEmail, validateQuotation } from '../shared/quotation-validation.js';
import { buildAcknowledgementEmail, buildLeadEmail } from './email-template.js';
import { resolveMail } from './mail.js';
import { createRateLimiter } from './rate-limit.js';
import { verifyTurnstile } from './turnstile.js';

const MAX_BODY_BYTES = 32 * 1024;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

const defaultLogger = {
  info: (event, meta) => console.log(JSON.stringify({ level: 'info', event, ...meta })),
  warn: (event, meta) => console.warn(JSON.stringify({ level: 'warn', event, ...meta })),
  error: (event, meta) => console.error(JSON.stringify({ level: 'error', event, ...meta })),
};

function clientIp(request, ctxIp) {
  if (ctxIp) return ctxIp;
  const h = request.headers;
  return (
    h.get('x-nf-client-connection-ip') ||
    h.get('x-real-ip') ||
    (h.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function originAllowed(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients (curl, test scripts); browsers always send Origin on POST
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost = new URL(request.url).host;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || requestHost;
  if (originHost === requestHost || originHost === host) return true;
  const extra = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return extra.some((allowed) => {
    try {
      return new URL(allowed).host === originHost;
    } catch {
      return allowed === originHost;
    }
  });
}

async function readJsonBody(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return { error: 413 };
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return { error: 413 };
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 400 };
    return { data };
  } catch {
    return { error: 400 };
  }
}

const stableStringify = (obj) => JSON.stringify(obj, Object.keys(obj).sort());

/**
 * @param {object} [deps]
 */
export function createQuotationHandler(deps = {}) {
  const logger = deps.logger ?? defaultLogger;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const nowFn = deps.now ?? (() => new Date());
  let limiter = deps.rateLimiter ?? null;
  let limiterKey = '';

  const sleep = deps.sleep;

  /**
   * @param {Request} request
   * @param {{ env?: Record<string,string|undefined>, ip?: string, requestId?: string }} [ctx]
   */
  return async function handleQuotation(request, ctx = {}) {
    const env = ctx.env ?? process.env;
    const requestId = ctx.requestId ?? randomUUID();
    const log = (level, event, meta = {}) => logger[level](event, { requestId, ...meta });

    if (request.method !== 'POST') {
      return json(405, { ok: false, code: 'method_not_allowed' }, { Allow: 'POST' });
    }
    if (!originAllowed(request, env)) {
      log('warn', 'quotation_origin_rejected');
      return json(403, { ok: false, code: 'forbidden' });
    }
    if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
      return json(415, { ok: false, code: 'unsupported_media_type' });
    }

    /* Rate limit (best effort per instance; the platform limit in the function config is the durable one). */
    const max = Number(env.RATE_LIMIT_MAX) || 6;
    const windowMs = (Number(env.RATE_LIMIT_WINDOW_SECONDS) || 600) * 1000;
    const wantedKey = `${max}:${windowMs}`;
    if (!limiter || (!deps.rateLimiter && limiterKey !== wantedKey)) {
      limiter = createRateLimiter({ max, windowMs });
      limiterKey = wantedKey;
    }
    const ip = clientIp(request, ctx.ip);
    const rate = limiter.check(ip);
    if (!rate.allowed) {
      log('warn', 'quotation_rate_limited');
      return json(429, { ok: false, code: 'rate_limited' }, { 'Retry-After': String(rate.retryAfterSeconds) });
    }

    const body = await readJsonBody(request);
    if (body.error) {
      return json(body.error, { ok: false, code: body.error === 413 ? 'payload_too_large' : 'bad_request' });
    }
    const payload = body.data;

    /* Honeypot: real visitors never see or fill this field. Pretend success so bots learn nothing. */
    if (typeof payload[HONEYPOT_FIELD] === 'string' && payload[HONEYPOT_FIELD].trim() !== '') {
      log('info', 'quotation_honeypot_triggered');
      return json(200, { ok: true });
    }

    /* Optional CAPTCHA (Cloudflare Turnstile). */
    if (env.TURNSTILE_SECRET_KEY) {
      const result = await verifyTurnstile({
        secret: env.TURNSTILE_SECRET_KEY,
        token: payload.turnstileToken,
        ip: ip === 'unknown' ? undefined : ip,
        verifyUrl: env.TURNSTILE_VERIFY_URL || undefined,
        fetchImpl,
      });
      if (!result.ok) {
        log('warn', 'quotation_captcha_failed', { unavailable: Boolean(result.unavailable) });
        return result.unavailable
          ? json(503, { ok: false, code: 'captcha_unavailable' })
          : json(400, { ok: false, code: 'captcha_failed' });
      }
    }

    /* Authoritative validation. */
    const validation = validateQuotation(payload);
    if (!validation.valid) {
      return json(400, { ok: false, code: 'validation_error', errors: validation.errors });
    }
    const values = validation.values;

    /* Server configuration. */
    const mail = resolveMail(env, { fetchImpl, sleep, smtpMailer: deps.smtpMailer });
    // LEAD_TO_EMAIL may hold several comma-separated addresses.
    const to = (env.LEAD_TO_EMAIL || BUSINESS.email)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => isValidEmail(s));
    if (mail.missing.length > 0 || to.length === 0) {
      log('error', 'quotation_not_configured', {
        provider: mail.provider,
        missing: [...mail.missing, ...(to.length ? [] : ['LEAD_TO_EMAIL (no valid address)'])],
      });
      return json(503, { ok: false, code: 'not_configured' });
    }

    /* Idempotency: same submission id + same content => same key => provider de-duplicates retries. */
    const rawId = typeof payload.submissionId === 'string' ? payload.submissionId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) : '';
    const submissionId = rawId.length >= 8 ? rawId : randomUUID();
    const contentHash = createHash('sha256')
      .update(stableStringify(values))
      .update(submissionId)
      .digest('hex');
    const idempotencyKey = `wecs-${contentHash.slice(0, 48)}`;
    const reference = `WE-${contentHash.slice(0, 6).toUpperCase()}`;

    const lead = buildLeadEmail(values, { reference, now: nowFn() });
    const sent = await mail.send({
      to,
      subject: lead.subject,
      html: lead.html,
      text: lead.text,
      replyTo: values.email || undefined,
      idempotencyKey,
    });

    if (!sent.ok) {
      // Status and provider error *code* only — never the message (it may echo addresses) or any form data.
      log('error', 'quotation_email_failed', { provider: mail.provider, providerStatus: sent.status, providerCode: sent.code });
      return json(502, { ok: false, code: 'email_failed' });
    }
    log('info', 'quotation_email_sent', { provider: mail.provider, reference });

    /* Optional customer acknowledgement. Never affects the response to the visitor. */
    if (String(env.SEND_CUSTOMER_CONFIRMATION).toLowerCase() === 'true' && values.email) {
      const ack = buildAcknowledgementEmail(values, {
        reference,
        businessEmail: to[0],
        businessPhones: BUSINESS.phones.map((p) => p.display),
      });
      const ackResult = await mail.send(
        {
          to: [values.email],
          subject: ack.subject,
          html: ack.html,
          text: ack.text,
          replyTo: to[0],
          idempotencyKey: `${idempotencyKey}-ack`,
        },
        { retries: 0, timeoutMs: 8000 },
      );
      if (!ackResult.ok) {
        log('warn', 'quotation_ack_failed', { providerStatus: ackResult.status, providerCode: ackResult.code });
      }
    }

    // A test mail server (RESEND_API_URL / SMTP_HOST overrides) is only ever used locally. Say so, so a local
    // test is never mistaken for real delivery.
    return json(200, { ok: true, reference, ...(mail.demo ? { demo: true } : {}) });
  };
}

/** Shared default instance (keeps the in-memory rate limiter across warm invocations). */
export const handleQuotationRequest = createQuotationHandler();

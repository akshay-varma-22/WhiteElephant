/**
 * Gmail (or any SMTP server) sender, built on Nodemailer. This is the Node.js equivalent of
 * `smtplib.SMTP_SSL('smtp.gmail.com', 465)` + `login(user, app_password)` + `send_message(...)`.
 *
 * Credentials come from SERVER-SIDE environment variables only (GMAIL_USER, GMAIL_APP_PASSWORD) and are
 * never sent to the browser. Notes about Gmail's behaviour:
 *   - Gmail always sends "From" the authenticated account, whatever From header is requested.
 *   - Unlike Resend, SMTP has no server-side idempotency key. To avoid duplicate emails when a visitor's
 *     browser retries, we (1) give every message a deterministic Message-ID, which Gmail uses to collapse
 *     duplicates delivered to the same mailbox, and (2) remember recently sent keys in memory (best effort:
 *     it lasts as long as the serverless instance stays warm).
 *   - Error text from SMTP servers can echo addresses, so only a short error CODE is ever returned or logged.
 */
import nodemailer from 'nodemailer';
import { BUSINESS } from '../shared/business.js';

export const GMAIL_HOST = 'smtp.gmail.com';
const MESSAGE_ID_DOMAIN = 'whiteelephantcreativestudio.in';
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const DEDUPE_MAX = 500;

/** Reads SMTP settings from env. Defaults target Gmail over SSL (port 465). */
export function gmailConfig(env) {
  const host = (env.SMTP_HOST || GMAIL_HOST).trim();
  const port = Number(env.SMTP_PORT) || 465;
  const secure = env.SMTP_SECURE !== undefined && env.SMTP_SECURE !== '' ? String(env.SMTP_SECURE).toLowerCase() === 'true' : port === 465;
  return {
    host,
    port,
    secure,
    user: (env.GMAIL_USER || BUSINESS.email).trim(),
    // Google shows app passwords as four groups of four letters ("abcd efgh ijkl mnop"); spaces are not part of it.
    pass: String(env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    /** True when pointed at a local test server instead of real Gmail. */
    isTestServer: host !== GMAIL_HOST,
  };
}

/**
 * Turns a Nodemailer/SMTP error into a safe, short classification.
 * @returns {{ status: number, code: string, retryable: boolean }}
 */
export function classifySmtpError(err) {
  const code = err?.code;
  const rc = Number(err?.responseCode) || 0;
  const response = String(err?.response || '');

  if (code === 'EAUTH' || rc === 535 || rc === 534) return { status: 535, code: 'smtp_auth_failed', retryable: false };
  if (/5\.4\.5|daily user sending limit|quota/i.test(response) && (rc === 550 || rc === 552)) {
    return { status: rc, code: 'smtp_quota_exceeded', retryable: false };
  }
  // Failures while connecting happened before any message data was sent, so a retry cannot duplicate mail.
  const beforeSend = err?.command === 'CONN' || code === 'EDNS' || code === 'ECONNREFUSED';
  if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNRESET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND'].includes(code)) {
    return { status: 0, code: 'smtp_connection_failed', retryable: beforeSend };
  }
  if (rc >= 400 && rc < 500) return { status: rc, code: 'smtp_temporary_failure', retryable: false };
  if (rc >= 500) return { status: rc, code: 'smtp_rejected', retryable: false };
  if (code === 'EENVELOPE' || code === 'EMESSAGE') return { status: 0, code: 'smtp_bad_message', retryable: false };
  return { status: 0, code: 'smtp_error', retryable: false };
}

/**
 * @param {{ createTransport?: Function, now?: () => number, sleep?: (ms:number)=>Promise<void> }} [deps]
 */
export function createSmtpMailer({
  createTransport = (options) => nodemailer.createTransport(options),
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  /** @type {Map<string, number>} idempotency key -> expiry time */
  const recent = new Map();

  const alreadySent = (key) => {
    const expires = recent.get(key);
    if (expires === undefined) return false;
    if (expires < now()) {
      recent.delete(key);
      return false;
    }
    return true;
  };
  const remember = (key) => {
    if (recent.size >= DEDUPE_MAX) recent.delete(recent.keys().next().value);
    recent.set(key, now() + DEDUPE_TTL_MS);
  };

  async function sendOnce(cfg, message) {
    const transporter = createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      ...(cfg.isTestServer ? {} : { tls: { minVersion: 'TLSv1.2' } }),
    });
    try {
      const info = await transporter.sendMail({
        from: { name: `${BUSINESS.name} Website`, address: cfg.user },
        to: message.to,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        messageId: `<${message.idempotencyKey}@${MESSAGE_ID_DOMAIN}>`,
      });
      // Nodemailer lists refused recipients without throwing when only some were rejected.
      if (Array.isArray(info?.accepted) && info.accepted.length === 0) {
        return { ok: false, status: 0, code: 'smtp_rejected', retryable: false };
      }
      return { ok: true, id: info?.messageId ?? null };
    } catch (err) {
      return { ok: false, ...classifySmtpError(err) };
    } finally {
      transporter.close?.();
    }
  }

  return {
    /**
     * @param {ReturnType<typeof gmailConfig>} cfg
     * @param {{ to: string[], subject: string, html: string, text: string, replyTo?: string, idempotencyKey: string }} message
     * @returns {Promise<{ ok: true, id: string|null, deduped?: boolean } | { ok: false, status: number, code: string, retryable: boolean }>}
     */
    async send(cfg, message, { retries = 1, delayMs = 400 } = {}) {
      if (alreadySent(message.idempotencyKey)) return { ok: true, id: null, deduped: true };
      let result = await sendOnce(cfg, message);
      for (let attempt = 0; attempt < retries && !result.ok && result.retryable; attempt += 1) {
        await sleep(delayMs);
        result = await sendOnce(cfg, message);
      }
      if (result.ok) remember(message.idempotencyKey);
      return result;
    },
    /** Test helper. */
    reset() {
      recent.clear();
    },
  };
}

export const defaultSmtpMailer = createSmtpMailer();

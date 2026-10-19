/**
 * Chooses how lead emails are delivered and hides the differences from the endpoint handler.
 *
 *   MAIL_PROVIDER=gmail   Gmail SMTP with an App Password   (GMAIL_USER, GMAIL_APP_PASSWORD)
 *   MAIL_PROVIDER=resend  Resend HTTPS API                  (RESEND_API_KEY, MAIL_FROM)
 *
 * If MAIL_PROVIDER is not set: Gmail is used when GMAIL_APP_PASSWORD is present, otherwise Resend.
 */
import { BUSINESS } from '../shared/business.js';
import { sendEmail as sendViaResend } from './mailer.js';
import { defaultSmtpMailer, gmailConfig } from './smtp-mailer.js';

export function selectProvider(env) {
  const explicit = String(env.MAIL_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'gmail' || explicit === 'smtp') return 'gmail';
  if (explicit === 'resend') return 'resend';
  return env.GMAIL_APP_PASSWORD ? 'gmail' : 'resend';
}

function isRealResendUrl(value) {
  try {
    return new URL(value).hostname === 'api.resend.com';
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, string|undefined>} env
 * @param {{ fetchImpl?: typeof fetch, sleep?: Function, smtpMailer?: typeof defaultSmtpMailer }} deps
 * @returns {{
 *   provider: 'gmail'|'resend',
 *   missing: string[],
 *   demo: boolean,
 *   send: (message: { to: string[], subject: string, html: string, text: string, replyTo?: string, idempotencyKey: string },
 *          options?: { retries?: number, timeoutMs?: number }) => Promise<any>
 * }}
 */
export function resolveMail(env, { fetchImpl, sleep, smtpMailer = defaultSmtpMailer } = {}) {
  const provider = selectProvider(env);

  if (provider === 'gmail') {
    const cfg = gmailConfig(env);
    return {
      provider,
      missing: cfg.pass ? [] : ['GMAIL_APP_PASSWORD'],
      demo: cfg.isTestServer,
      send: (message, options = {}) => smtpMailer.send(cfg, message, { retries: options.retries ?? 1 }),
    };
  }

  const from = (env.MAIL_FROM || `${BUSINESS.name} Website <onboarding@resend.dev>`).trim();
  const apiUrl = env.RESEND_API_URL || undefined;
  return {
    provider,
    missing: env.RESEND_API_KEY ? [] : ['RESEND_API_KEY'],
    demo: Boolean(apiUrl) && !isRealResendUrl(apiUrl),
    send: (message, options = {}) =>
      sendViaResend(
        {
          apiKey: env.RESEND_API_KEY,
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo,
          idempotencyKey: message.idempotencyKey,
          apiUrl,
          fetchImpl,
          ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
        },
        { retries: options.retries ?? 1, ...(sleep ? { sleep } : {}) },
      ),
  };
}

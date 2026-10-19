/**
 * Resend transactional email client (https://resend.com/docs/api-reference/emails/send-email).
 *
 * - Uses the HTTPS API directly (no SDK, no dependencies).
 * - Sends an Idempotency-Key so a retry (or a duplicate request) can never deliver the same email twice
 *   (Resend remembers keys for 24 hours).
 * - Never logs or returns the provider's error *message* (it can echo addresses); only status + error name.
 */
export const DEFAULT_RESEND_URL = 'https://api.resend.com/emails';

/**
 * @typedef {{ ok: true, id: string|null } | { ok: false, status: number, code: string, retryable: boolean }} SendResult
 */

/**
 * @param {object} args
 * @param {string} args.apiKey
 * @param {string} args.from
 * @param {string|string[]} args.to
 * @param {string} args.subject
 * @param {string} args.html
 * @param {string} args.text
 * @param {string} [args.replyTo]
 * @param {string} args.idempotencyKey
 * @param {string} [args.apiUrl]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {number} [args.timeoutMs]
 * @returns {Promise<SendResult>}
 */
export async function sendEmailOnce({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  idempotencyKey,
  apiUrl = DEFAULT_RESEND_URL,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}) {
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'User-Agent': 'white-elephant-website/1.0',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return { ok: false, status: 0, code: timedOut ? 'timeout' : 'network_error', retryable: true };
  }

  if (response.ok) {
    let id = null;
    try {
      id = (await response.json())?.id ?? null;
    } catch {
      /* body is informational only */
    }
    return { ok: true, id };
  }

  let code = 'unknown_error';
  try {
    const body = await response.json();
    if (typeof body?.name === 'string') code = body.name.slice(0, 60);
  } catch {
    /* non-JSON error body */
  }
  const retryable = response.status >= 500 || (response.status === 409 && code === 'concurrent_idempotent_requests');
  return { ok: false, status: response.status, code, retryable };
}

/** Sends with one retry for transient failures. Safe because of the Idempotency-Key. */
export async function sendEmail(args, { retries = 1, delayMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let result = await sendEmailOnce(args);
  for (let attempt = 0; attempt < retries && !result.ok && result.retryable; attempt += 1) {
    await sleep(delayMs);
    result = await sendEmailOnce(args);
  }
  return result;
}

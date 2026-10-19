import { QUOTATION_ENDPOINT } from '../../shared/quotation-options.js';

/**
 * Failure kinds the form knows how to explain to a visitor:
 *  validation   - server rejected specific fields (err.errors)
 *  rate_limited - too many requests
 *  captcha      - CAPTCHA missing/failed (visitor can retry)
 *  network      - request never completed (offline, timeout, DNS ...)
 *  server       - the lead could not be accepted (email provider/config problem, 5xx)
 */
export class SubmitError extends Error {
  constructor(kind, { status = 0, errors = null } = {}) {
    super(kind);
    this.name = 'SubmitError';
    this.kind = kind;
    this.status = status;
    this.errors = errors;
  }
}

/**
 * POSTs the quotation. Resolves ONLY when the server confirms `{ ok: true }`
 * (which it sends only after the email provider accepted the message).
 */
export async function submitQuotation(payload, { fetchImpl = fetch, timeoutMs = 25_000, signal } = {}) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort);

  let response;
  try {
    response = await fetchImpl(QUOTATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: timeout.signal,
      credentials: 'same-origin',
    });
  } catch {
    throw new SubmitError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* non-JSON body: handled by status below */
  }

  if (response.ok && data?.ok === true) return { reference: data.reference ?? null, demo: data.demo === true };

  if (response.status === 400 && data?.code === 'validation_error' && data.errors) {
    throw new SubmitError('validation', { status: 400, errors: data.errors });
  }
  if (response.status === 400 && data?.code === 'captcha_failed') throw new SubmitError('captcha', { status: 400 });
  if (response.status === 429) throw new SubmitError('rate_limited', { status: 429 });
  throw new SubmitError('server', { status: response.status });
}

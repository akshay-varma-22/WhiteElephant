/**
 * Cloudflare Turnstile server-side verification (optional CAPTCHA).
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 * Tokens are single-use and valid for 5 minutes.
 */
export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** @returns {Promise<{ ok: boolean, unavailable?: boolean }>} */
export async function verifyTurnstile({ secret, token, ip, verifyUrl = TURNSTILE_VERIFY_URL, fetchImpl = fetch, timeoutMs = 8000 }) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return { ok: false };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetchImpl(verifyUrl, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, unavailable: res.status >= 500 };
    const data = await res.json();
    return { ok: data?.success === true };
  } catch {
    return { ok: false, unavailable: true };
  }
}

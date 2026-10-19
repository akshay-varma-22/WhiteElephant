/**
 * Small in-memory sliding-window rate limiter.
 *
 * Serverless instances are short-lived and not shared, so this is a best-effort
 * second layer. The durable, platform-level limit is declared in
 * netlify/functions/quotation.mjs (`config.rateLimit`).
 */
export function createRateLimiter({ max = 6, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  /** @type {Map<string, number[]>} */
  const hits = new Map();

  function prune(timestamp) {
    for (const [key, list] of hits) {
      const fresh = list.filter((t) => timestamp - t < windowMs);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }

  return {
    /** @returns {{ allowed: boolean, retryAfterSeconds: number }} */
    check(key) {
      const t = now();
      if (hits.size > 5000) prune(t);
      const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (list.length >= max) {
        hits.set(key, list);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (t - list[0])) / 1000)) };
      }
      list.push(t);
      hits.set(key, list);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset() {
      hits.clear();
    },
  };
}

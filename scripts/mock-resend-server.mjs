/**
 * Local stand-in for the Resend email API — FOR DEVELOPMENT AND AUTOMATED TESTS ONLY.
 *
 *   npm run mock-email            # listens on http://127.0.0.1:4010
 *
 * It accepts `POST /emails` exactly like Resend (Bearer auth, Idempotency-Key, JSON body),
 * keeps messages in memory, and exposes control endpoints used by the E2E tests:
 *
 *   GET  /__emails            list captured messages
 *   POST /__reset             clear captured messages and reset the failure mode
 *   POST /__mode {"mode":..}  ok | server_error | forbidden | quota | slow
 *
 * Nothing is ever delivered to a real mailbox. Do not use real customer data with it.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export function startMockResend({ port = 4010, host = '127.0.0.1', apiKey = 'test_key' } = {}) {
  /** @type {Array<object>} */
  let emails = [];
  const seenKeys = new Map();
  let mode = 'ok';
  let counter = 0;

  const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const readBody = (req) =>
    new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => resolve(data));
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/__emails' && req.method === 'GET') return send(res, 200, emails);
    if (url.pathname === '/__reset' && req.method === 'POST') {
      emails = [];
      seenKeys.clear();
      mode = 'ok';
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/__mode' && req.method === 'POST') {
      mode = JSON.parse((await readBody(req)) || '{}').mode ?? 'ok';
      return send(res, 200, { mode });
    }

    if (url.pathname !== '/emails' || req.method !== 'POST') {
      return send(res, 404, { statusCode: 404, name: 'not_found', message: 'Route not found.' });
    }

    if (req.headers.authorization !== `Bearer ${apiKey}`) {
      await readBody(req);
      return send(res, 401, { statusCode: 401, name: 'missing_api_key', message: 'API key is invalid.' });
    }

    const raw = await readBody(req);
    if (mode === 'server_error') return send(res, 500, { statusCode: 500, name: 'application_error', message: 'Unexpected error.' });
    if (mode === 'forbidden')
      return send(res, 403, { statusCode: 403, name: 'validation_error', message: 'The domain is not verified.' });
    if (mode === 'quota') return send(res, 429, { statusCode: 429, name: 'daily_quota_exceeded', message: 'Quota exceeded.' });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 1500));

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(res, 400, { statusCode: 400, name: 'validation_error', message: 'Invalid JSON.' });
    }
    for (const field of ['from', 'to', 'subject']) {
      if (!body[field]) return send(res, 422, { statusCode: 422, name: 'missing_required_field', message: `Missing ${field}.` });
    }

    const key = req.headers['idempotency-key'];
    if (key && seenKeys.has(key)) {
      const prior = seenKeys.get(key);
      if (prior.raw !== raw) return send(res, 409, { statusCode: 409, name: 'invalid_idempotent_request', message: 'Key reused.' });
      return send(res, 200, { id: prior.id }); // same response, no second email
    }

    counter += 1;
    const id = `mock-${String(counter).padStart(4, '0')}`;
    if (key) seenKeys.set(key, { raw, id });
    emails.push({ id, idempotencyKey: key ?? null, ...body });
    return send(res, 200, { id });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () =>
      resolve({
        url: `http://${host}:${port}`,
        emails: () => emails,
        close: () => new Promise((r) => server.close(() => r())),
      }),
    );
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.MOCK_RESEND_PORT) || 4010;
  startMockResend({ port }).then(({ url }) => {
    console.log(`Mock Resend API listening at ${url}  (API key: test_key)`);
    console.log('Point the site at it with RESEND_API_URL=' + url + '/emails and RESEND_API_KEY=test_key');
  });
}

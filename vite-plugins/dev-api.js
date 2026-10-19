/**
 * Serves POST /api/quotation inside `vite dev` and `vite preview`, using the very same
 * handler as the Netlify Function (server/handler.js). Development convenience only:
 * this plugin is not part of the production build, which ships static files + the function.
 *
 * Environment variables come from `.env` / `.env.local` (git-ignored) and the real environment.
 */
import { loadEnv } from 'vite';
import { QUOTATION_ENDPOINT } from '../shared/quotation-options.js';

async function toWebRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const origin = `http://${req.headers.host || 'localhost'}`;
  return new Request(new URL(req.url, origin), {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
}

export function devApi({ mode }) {
  let env = {};

  const attach = (server, loadHandler) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url || new URL(req.url, 'http://x').pathname !== QUOTATION_ENDPOINT) return next();
      try {
        const handler = await loadHandler();
        const request = await toWebRequest(req);
        const response = await handler(request, {
          env: { ...process.env, ...env },
          ip: req.socket.remoteAddress,
          requestId: `dev-${Date.now().toString(36)}`,
        });
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (err) {
        console.error('[dev-api] unexpected error', err?.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, code: 'internal_error' }));
      }
    });
  };

  return {
    name: 'we-dev-api',
    config(_, { mode: m }) {
      env = loadEnv(m || mode, process.cwd(), '');
    },
    configureServer(server) {
      attach(server, async () => (await server.ssrLoadModule('/server/handler.js')).handleQuotationRequest);
    },
    configurePreviewServer(server) {
      attach(server, async () => (await import('../server/handler.js')).handleQuotationRequest);
    },
  };
}

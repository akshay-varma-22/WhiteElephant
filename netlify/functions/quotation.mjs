/**
 * Netlify Function (v2) — POST /api/quotation
 *
 * All logic lives in server/handler.js (unit-tested). This file only adapts Netlify's
 * context and declares the platform-level rate limit.
 *
 * Secrets (RESEND_API_KEY etc.) are read from Netlify environment variables at runtime
 * and never reach the browser bundle. See .env.example and docs/DEPLOYMENT.md.
 */
import { handleQuotationRequest } from '../../server/handler.js';

export default async (request, context) =>
  handleQuotationRequest(request, {
    env: process.env,
    ip: context.ip,
    requestId: context.requestId,
  });

export const config = {
  path: '/api/quotation',
  // Durable per-visitor limit enforced by Netlify before the function runs (returns HTTP 429).
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

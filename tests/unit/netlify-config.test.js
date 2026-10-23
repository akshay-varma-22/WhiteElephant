import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUSINESS } from '../../shared/business.js';

const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8');

describe('netlify.toml', () => {
  it('sends the old netlify.app address to the studio domain with a permanent redirect, so there is one public address', () => {
    const rule = toml.match(/\[\[redirects\]\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
    expect(rule).toContain('from = "https://exquisite-beijinho-3476dc.netlify.app/*"');
    expect(rule).toContain(`to = "${BUSINESS.url}/:splat"`);
    expect(rule).toMatch(/status\s*=\s*301/);
    expect(rule).toMatch(/force\s*=\s*true/);
  });

  it('keeps the security headers and never caches the API', () => {
    expect(toml).toContain('Strict-Transport-Security');
    expect(toml).toMatch(/for = "\/api\/\*"[\s\S]*Cache-Control = "no-store"/);
  });
});

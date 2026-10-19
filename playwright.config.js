import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the PRODUCTION build (`vite preview`) with the real function handler,
 * pointed at a local mock of the Resend API (scripts/mock-resend-server.mjs). No real email is sent.
 *
 * Uses the Microsoft Edge / Chrome already installed on the machine, so no browser download is needed.
 * Override with PW_CHANNEL=chrome, or set PW_CHANNEL= (empty) to use Playwright's bundled Chromium.
 */
const channel = process.env.PW_CHANNEL === undefined ? 'msedge' : process.env.PW_CHANNEL || undefined;
const PORT = 5199;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // the mock mailbox is shared, so tests run one at a time
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    channel,
  },
  projects: [
    {
      name: 'desktop',
      grepInvert: /@mobile/,
      use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], channel },
    },
  ],
  webServer: {
    command: `npm run build && node scripts/dev-with-mock.mjs preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { MOCK_RESEND_PORT: '4011', RATE_LIMIT_MAX: '500' },
  },
});

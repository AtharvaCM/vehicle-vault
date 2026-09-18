import { defineConfig, devices } from '@playwright/test';

import { resolveApiProxyTarget } from './tests/e2e/helpers/api-target';
import { resolveE2eDatabaseUrl } from './tests/e2e/helpers/database-target';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4307';
// Both guards run here, at config load, so a refusal lands before the dev
// server boots or any spec runs. The API proxy is local by default and refuses
// production without an override; the database the specs write to directly
// must be local unless overridden. See each helper for why.
const apiProxyTarget = resolveApiProxyTarget(process.env);
resolveE2eDatabaseUrl(process.env);

export default defineConfig({
  testDir: './tests/e2e',
  // Helpers are imported by specs, not run as specs — and one of them carries a
  // Vitest unit test that Playwright must not try to execute.
  testIgnore: ['**/helpers/**'],
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  outputDir: './test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4307',
    // Passed as env rather than interpolated into the command, so a target read
    // from the environment is never parsed by a shell. Playwright layers this
    // over `process.env`, so PATH and friends are unaffected.
    env: {
      VITE_API_BASE_URL: '/api',
      VITE_API_PROXY_TARGET: apiProxyTarget,
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});

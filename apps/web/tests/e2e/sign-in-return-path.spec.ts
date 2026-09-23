import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * A signed-out visitor who opens a signed-in page is sent to sign in and, once
 * signed in or registered, lands back on that page, not on the dashboard.
 */

const PASSWORD = 'VehicleVault!234';
const DEEP_LINK = '/settings/preferences';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function existingAccount(request: APIRequestContext) {
  const suffix = uniqueSuffix();
  const email = `e2e+return-${suffix}@vehiclevault.dev`;
  const response = await request.post('/api/auth/register', {
    data: { name: `E2E Return ${suffix}`, email, password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return email;
}

async function signIn(page: Page, email: string) {
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

test('a deep link opened signed out comes back after sign-in', async ({ page, request }) => {
  const email = await existingAccount(request);

  await page.goto(DEEP_LINK);

  await expect(page).toHaveURL(/\/login\?next=%2Fsettings%2Fpreferences$/);

  await signIn(page, email);

  await expect(page).toHaveURL(new RegExp(`${DEEP_LINK}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/notification/i);
});

test('a deep link survives switching to registration', async ({ page }) => {
  const suffix = uniqueSuffix();

  await page.goto(DEEP_LINK);
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/\/register\?next=%2Fsettings%2Fpreferences$/);

  await page.getByLabel(/^name$/i).fill(`E2E Return ${suffix}`);
  await page.getByLabel(/email address/i).fill(`e2e+return-reg-${suffix}@vehiclevault.dev`);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(new RegExp(`${DEEP_LINK}$`));
});

test('a next that leads off the site is ignored', async ({ page, request }) => {
  const email = await existingAccount(request);

  await page.goto(`/login?next=${encodeURIComponent('//evil.example.test/dashboard')}`);
  await signIn(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
  expect(new URL(page.url()).host).not.toContain('evil.example.test');
});

import { expect, test } from '@playwright/test';

import { registerAndSignIn, registerUnverified } from './helpers/auth';

/**
 * A verification or reset link that no longer works says so, and never signs
 * anyone out on the way.
 */

function newAccount(tag: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return {
    name: `E2E Links ${suffix}`,
    email: `e2e+links-${tag}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  };
}

const SPENT = 'This link has expired or was already used';

test('a spent verification link keeps a signed-in, unverified user signed in', async ({ page }) => {
  await registerUnverified(page, newAccount('unverified'));

  await page.goto('/verify-email?token=not-a-real-token');

  await expect(page.getByText(SPENT).first()).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email\?token=not-a-real-token$/);
  await expect(page.getByRole('button', { name: 'Send a new link' })).toBeVisible();

  await page.getByRole('link', { name: 'Continue to your garage' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('an old verification link opened by a verified user is simply done', async ({ page }) => {
  await registerAndSignIn(page, newAccount('verified'));

  await page.goto('/verify-email?token=not-a-real-token');

  await expect(page.getByText('Already verified').first()).toBeVisible();

  await page.getByRole('link', { name: 'Continue to your garage' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
});

test('a spent verification link opened signed out stays on the page and says why', async ({
  page,
}) => {
  await page.goto('/verify-email?token=not-a-real-token');

  await expect(page.getByText(SPENT).first()).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email\?token=not-a-real-token$/);
});

test('a reset link without a token, or a spent one, offers a new link', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByText('This reset link is incomplete').first()).toBeVisible();
  await expect(page.getByLabel(/token/i)).toHaveCount(0);

  await page.goto('/reset-password?token=not-a-real-token');
  await expect(page.getByLabel(/token/i)).toHaveCount(0);
  await page.getByLabel(/^new password$/i).fill('VehicleVault!999');
  await page.getByLabel(/confirm new password/i).fill('VehicleVault!999');
  await page.getByRole('button', { name: /reset password/i }).click();

  await expect(page.getByText(SPENT).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible();
});

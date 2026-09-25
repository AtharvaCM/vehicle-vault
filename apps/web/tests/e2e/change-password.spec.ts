import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`a password is changed from Settings, and only the new one signs in, at ${viewport.width}px`, async ({
    page,
    browser,
  }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e+password${suffix}@vehiclevault.dev`;
    const oldPassword = 'VehicleVault!234';
    const newPassword = 'VehicleVault!567';
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, { name: `E2E Password ${suffix}`, email, password: oldPassword });

    // A second device, signed in with the old password.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto('/login');
    await otherPage.getByLabel(/email address/i).fill(email);
    await otherPage.getByLabel(/^password$/i).fill(oldPassword);
    await otherPage.getByRole('button', { name: /sign in/i }).click();
    await expect(otherPage).toHaveURL(/\/home$/);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
    await expect(
      page.getByTestId('settings-row').filter({ hasText: 'Sign-in methods' }),
    ).toContainText('Email and password');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/settings-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    await page
      .getByTestId('settings-row')
      .filter({ hasText: 'Password' })
      .getByRole('button', { name: /Change/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Change password' });
    await dialog.getByLabel('Current password').fill(oldPassword);
    await dialog.getByLabel('New password', { exact: true }).fill(newPassword);
    await dialog.getByLabel('New password again').fill(newPassword);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/settings-password-${viewport.width}.png`,
        animations: 'disabled',
      });
    await dialog.getByRole('button', { name: 'Change password' }).click();
    await expect(dialog).toBeHidden();

    // This device stays signed in.
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();

    // The other device is signed out once its access token needs refreshing.
    await otherPage.evaluate(() => {
      const raw = window.localStorage.getItem('vehicle-vault.auth-session');
      if (!raw) return;
      const session = JSON.parse(raw) as Record<string, unknown>;
      window.localStorage.setItem(
        'vehicle-vault.auth-session',
        JSON.stringify({ ...session, accessToken: 'expired' }),
      );
    });
    await otherPage.goto('/home');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();

    // Only the new password signs in now.
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto('/login');
    await freshPage.getByLabel(/email address/i).fill(email);
    await freshPage.getByLabel(/^password$/i).fill(oldPassword);
    await freshPage.getByRole('button', { name: /sign in/i }).click();
    await expect(freshPage.getByText('Invalid email or password.').first()).toBeVisible();
    await freshPage.getByLabel(/^password$/i).fill(newPassword);
    await freshPage.getByRole('button', { name: /sign in/i }).click();
    await expect(freshPage).toHaveURL(/\/home$/);
    await fresh.close();
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

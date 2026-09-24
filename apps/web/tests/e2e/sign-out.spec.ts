import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';

/**
 * Signing out on purpose is not a session expiring. Queries still mounted when
 * the session is cleared refetch without a token and come back 401; that must
 * not raise "Session expired" next to "Signed out".
 */

const PASSWORD = 'VehicleVault!234';

declare global {
  interface Window {
    __toastTitles?: string[];
  }
}

test('signing out shows only the signed-out toast', async ({ page }) => {
  // Toasts dismiss themselves, so note every one that appears rather than
  // counting whatever is on screen at one moment.
  await page.addInitScript(() => {
    window.__toastTitles = [];
    const seen = new WeakSet<Element>();
    new MutationObserver(() => {
      document.querySelectorAll('[data-sonner-toast]').forEach((toast) => {
        if (seen.has(toast)) return;
        seen.add(toast);
        window.__toastTitles?.push(toast.querySelector('[data-title]')?.textContent ?? '');
      });
    }).observe(document, { childList: true, subtree: true });
  });

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const name = `E2E Sign Out ${suffix}`;
  await registerAndSignIn(page, {
    email: `e2e+sign-out-${suffix}@vehiclevault.dev`,
    name,
    password: PASSWORD,
  });

  await page.getByRole('button', { name }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Signed out' })).toBeVisible();
  // Give a request that raced the sign-out time to land. The refetch that used
  // to raise "Session expired" answered within a few hundred milliseconds.
  await page.waitForTimeout(1500);

  expect(await page.evaluate(() => window.__toastTitles)).toEqual(['Signed out']);
});

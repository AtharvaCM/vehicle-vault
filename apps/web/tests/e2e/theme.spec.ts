import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';

const STORAGE_KEY = 'vehicle-vault.theme';

function htmlTheme(page: Page) {
  return page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
  }));
}

test.describe('theme', () => {
  test('follows the system with no choice made', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    expect(await htmlTheme(page)).toEqual({ dark: true, colorScheme: 'dark' });

    await page.emulateMedia({ colorScheme: 'light' });
    // On System the page follows a change in the system while it's open.
    await expect.poll(async () => (await htmlTheme(page)).dark).toBe(false);
  });

  test('is on <html> before any app code runs, so nothing flashes', async ({ page }) => {
    await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), STORAGE_KEY);
    // No app module at all: only index.html's inline script can set the theme.
    await page.route('**/src/main.tsx', (route) => route.abort());

    await page.goto('/login');

    expect(await htmlTheme(page)).toEqual({ dark: true, colorScheme: 'dark' });
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
      'content',
      '#0f1216',
    );
  });

  test('the account menu switches it, and the choice is kept on this device', async ({ page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const name = `E2E Theme ${suffix}`;
    await page.emulateMedia({ colorScheme: 'light' });
    await registerAndSignIn(page, {
      name,
      email: `e2e+theme${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });

    await page.getByRole('button', { name }).click();
    const themes = page.getByRole('group', { name: 'Theme' });
    await expect(themes.getByRole('menuitemradio', { name: 'System' })).toBeChecked();

    await themes.getByRole('menuitemradio', { name: 'Dark' }).click();
    expect(await htmlTheme(page)).toEqual({ dark: true, colorScheme: 'dark' });
    await expect(themes.getByRole('menuitemradio', { name: 'Dark' })).toBeChecked();

    await page.reload();
    expect(await htmlTheme(page)).toEqual({ dark: true, colorScheme: 'dark' });
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBe(
      'dark',
    );

    // Back to System: the stored choice goes and the (light) system shows.
    await page.getByRole('button', { name }).click();
    await page
      .getByRole('group', { name: 'Theme' })
      .getByRole('menuitemradio', { name: 'System' })
      .click();
    expect(await htmlTheme(page)).toEqual({ dark: false, colorScheme: 'light' });
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBeNull();
  });
});

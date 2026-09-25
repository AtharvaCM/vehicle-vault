import { expect, test, type Browser, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const FIREFOX_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';

/** Another device: its own browser context, signed in with the same account. */
async function signInElsewhere(browser: Browser, email: string, password: string) {
  const context = await browser.newContext({ userAgent: FIREFOX_ON_WINDOWS });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/home$/);
  return { context, page };
}

/**
 * The access token lasts an hour; a device learns it was signed out at its
 * next refresh. Spoiling the stored access token makes that refresh happen now.
 */
async function forceRefresh(page: Page) {
  await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    if (!raw) return;
    const session = JSON.parse(raw) as Record<string, unknown>;
    window.localStorage.setItem(
      'vehicle-vault.auth-session',
      JSON.stringify({ ...session, accessToken: 'expired' }),
    );
  });
  await page.goto('/home');
}

for (const viewport of VIEWPORTS) {
  test(`Settings lists where you are signed in, and signs other devices out, at ${viewport.width}px`, async ({
    page,
    browser,
  }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e+sessions${suffix}@vehiclevault.dev`;
    const password = 'VehicleVault!234';
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, { name: `E2E Sessions ${suffix}`, email, password });

    // A second device signs in, and the first one stays signed in.
    const laptop = await signInElsewhere(browser, email, password);
    await page.goto('/settings');
    const rows = page.getByTestId('session-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('This device');
    await expect(rows.nth(1)).toContainText('Firefox on Windows');
    await expect(rows.nth(1)).toContainText('Active now');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/sessions-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Sign that one out from here: it lands on sign-in at its next refresh.
    await page.getByRole('button', { name: 'Sign out Firefox on Windows' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(rows).toHaveCount(1);
    await forceRefresh(laptop.page);
    await expect(laptop.page).toHaveURL(/\/login/);
    await laptop.context.close();

    // "Sign out other devices" does the same for every other one at once.
    const tablet = await signInElsewhere(browser, email, password);
    const phone = await signInElsewhere(browser, email, password);
    await page.reload();
    await expect(rows).toHaveCount(3);
    await page.getByRole('button', { name: /Sign out other devices/ }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Sign out the other 2 devices?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
    await expect(rows).toHaveCount(1);
    for (const other of [tablet, phone]) {
      await forceRefresh(other.page);
      await expect(other.page).toHaveURL(/\/login/);
      await other.context.close();
    }

    // This device carried on, and each sign-out was recorded.
    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const actions = await prisma.auditEvent.findMany({
      where: { actorUserId: user.id, action: { startsWith: 'auth.' } },
      select: { action: true },
    });
    expect(actions.map((event) => event.action)).toEqual(
      expect.arrayContaining(['auth.session_revoked', 'auth.other_sessions_revoked']),
    );
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

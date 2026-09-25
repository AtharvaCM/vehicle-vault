import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/** Seeds through the API as the signed-in user: far quicker than the forms. */
async function post(page: Page, path: string, data: object) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api/${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `POST ${path}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/**
 * #318: activity reads as sentences, actor first and grouped by day. Settings
 * splits garage changes from sign-ins and security, with "Not you?" beside a
 * failed sign-in; the vehicle shows only its own changes.
 */
for (const viewport of VIEWPORTS) {
  test(`activity reads as plain sentences, at ${viewport.width}px`, async ({ page, browser }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `e2e+activity${suffix}@vehiclevault.dev`;
    const nickname = `Activity ${suffix.slice(-4)}`;
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Activity ${suffix}`,
      email,
      password: 'VehicleVault!234',
    });

    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12AC${suffix.slice(-4)}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname,
    });
    await post(page, `fuel-logs/vehicle/${vehicle.id}`, {
      date: new Date().toISOString(),
      odometer: 18500,
      quantity: 28,
      price: 107,
      totalCost: 2996,
    });

    // Someone else tries the account with the wrong password.
    const stranger = await browser.newContext();
    const strangerPage = await stranger.newPage();
    await strangerPage.goto('/login');
    await strangerPage.getByLabel(/email address/i).fill(email);
    await strangerPage.getByLabel(/^password$/i).fill('not-the-password');
    await strangerPage.getByRole('button', { name: /sign in/i }).click();
    await expect(strangerPage.getByText('Invalid email or password.').first()).toBeVisible();
    await stranger.close();

    // Garage changes, in words, actor first, under today.
    await page.goto('/settings/activity');
    const day = page.getByTestId('activity-day').first();
    await expect(day).toHaveAttribute('aria-label', 'Today');
    const fill = page.getByTestId('activity-row').filter({ hasText: 'You logged a fuel fill' });
    await expect(fill).toContainText('You logged a fuel fill — 28 L · ₹2,996 · 18,500 km');
    await expect(fill.getByRole('link', { name: 'You logged a fuel fill' })).toBeVisible();
    await expect(
      page.getByTestId('activity-row').filter({ hasText: `You added ${nickname}` }),
    ).toBeVisible();
    await expect(page.getByText('You signed in')).toHaveCount(0);
    await expectNoSidewaysScroll(page, 'garage changes');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/activity-garage-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Sign-ins and security, with "Not you?" beside the failed attempt.
    await page.getByRole('radio', { name: 'Sign-ins & security' }).click();
    const failed = page
      .getByTestId('activity-row')
      .filter({ hasText: 'Someone tried to sign in to your account and failed' });
    await expect(failed).toContainText('wrong password');
    await expect(failed.getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/settings',
    );
    // Registering signs in without a separate sign-in event.
    await expect(
      page.getByTestId('activity-row').filter({ hasText: 'You created the account' }),
    ).toBeVisible();
    await expect(page.getByText('You logged a fuel fill')).toHaveCount(0);
    await page.getByRole('switch', { name: 'Show technical details' }).click();
    await expect(page.getByTestId('activity-technical').first()).toContainText('auth.');
    await expectNoSidewaysScroll(page, 'sign-ins and security');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/activity-security-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // The vehicle's own activity: its changes, never the account's sign-ins.
    await page.goto(`/vehicles/${vehicle.id}?tab=more&section=activity`);
    await expect(
      page.getByTestId('activity-row').filter({ hasText: 'You logged a fuel fill' }),
    ).toBeVisible();
    await expect(page.getByText('You signed in')).toHaveCount(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.id).toBeTruthy();
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

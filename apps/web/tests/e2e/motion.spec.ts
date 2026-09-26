import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

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

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** A signed-in account whose Home has three rows needing attention. */
async function homeWithAttention(page: Page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await registerAndSignIn(page, {
    name: `E2E Motion ${suffix}`,
    email: `e2e+motion${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const vehicle = await post(page, 'vehicles', {
    registrationNumber: `MH12MO${suffix.slice(-4)}`,
    make: 'Hyundai',
    model: 'Creta',
    year: 2024,
    vehicleType: 'suv',
    fuelType: 'petrol',
    odometer: 15000,
  });
  for (const [title, days] of [
    ['Brake pads', -3],
    ['Wheel alignment', 0],
    ['Coolant top-up', 3],
  ] as const) {
    await post(page, `vehicles/${vehicle.id}/reminders`, {
      title,
      type: 'service',
      dueDate: daysFromNow(days),
    });
  }
}

/** The animation on each attention row's wrapper, as the browser computes it. */
function rowAnimations(page: Page) {
  return page.getByTestId('attention-row').evaluateAll((rows) =>
    rows.map((row) => {
      const style = getComputedStyle(row.parentElement as HTMLElement);
      return {
        name: style.animationName,
        durationMs: parseFloat(style.animationDuration) * 1000,
        delayMs: parseFloat(style.animationDelay) * 1000,
      };
    }),
  );
}

/**
 * #354: one orchestrated moment. Home's attention rows rise in once per page
 * load, all done within half a second; returning to Home does not replay it,
 * and reduced motion gets no entrance at all. Overlays fade rather than zoom.
 */
test('Home’s attention rows rise in once per load, within half a second', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await homeWithAttention(page);
  await page.reload();
  await expect(page.getByTestId('attention-row').first()).toBeVisible();

  const first = await rowAnimations(page);
  expect(first.length).toBeGreaterThanOrEqual(3);
  for (const row of first) {
    expect(row.name).toBe('attention-enter');
    expect(row.delayMs + row.durationMs).toBeLessThan(500);
  }

  // Back to Home within the same load: no replay.
  await page.getByRole('link', { name: 'Garage' }).first().click();
  await page.getByRole('link', { name: 'Home' }).first().click();
  await expect(page.getByTestId('attention-row').first()).toBeVisible();
  for (const row of await rowAnimations(page)) expect(row.name).toBe('none');

  // The Log overlay fades in: no zoom or slide.
  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const menu = page.locator('[role="menu"], [role="dialog"]').first();
  await expect(menu).toBeVisible();
  const transform = await menu.evaluate((element) => getComputedStyle(element).transform);
  expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
});

test('reduced motion: no entrance and no transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await homeWithAttention(page);
  await page.reload();
  await expect(page.getByTestId('attention-row').first()).toBeVisible();

  for (const row of await rowAnimations(page)) expect(row.name).toBe('none');
  const link = page.getByRole('link', { name: 'Garage' }).first();
  const duration = await link.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

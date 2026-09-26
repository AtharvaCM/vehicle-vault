import { expect, test, type Locator, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

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

/** The plate showing `grouped` inside `scope`, and whether it is green. */
async function expectGreenPlate(scope: Locator, grouped: string, label: string) {
  const plate = scope.locator('[data-slot="number-plate"]').filter({ hasText: grouped }).first();
  await expect(plate, label).toHaveAttribute('data-variant', 'electric');
}

/**
 * #355: an electric vehicle carries a green plate everywhere the app names a
 * vehicle, beside a petrol one on a white plate.
 */
for (const viewport of VIEWPORTS) {
  test(`an EV's plate is green on Home, Upcoming, Quick log and Costs, at ${viewport.width}px`, async ({
    page,
  }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const digits = suffix.slice(-4);
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Plates ${suffix}`,
      email: `e2e+plates${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const ev = await post(page, 'vehicles', {
      registrationNumber: `MH12EV${digits}`,
      make: 'Tata',
      model: 'Nexon EV',
      year: 2024,
      vehicleType: 'suv',
      fuelType: 'electric',
      odometer: 8000,
      nickname: `Nexon ${digits}`,
    });
    const petrol = await post(page, 'vehicles', {
      registrationNumber: `MH12PE${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 15000,
      nickname: `Creta ${digits}`,
    });
    for (const vehicle of [ev, petrol]) {
      await post(page, `vehicles/${vehicle.id}/reminders`, {
        title: 'Wheel alignment',
        type: 'service',
        dueDate: daysFromNow(-2),
      });
      await post(page, `vehicles/${vehicle.id}/maintenance-records`, {
        category: 'other',
        status: 'confirmed',
        serviceDate: daysFromNow(-20),
        odometer: 7000,
        totalCost: 1200,
      });
    }
    const evPlate = `MH 12 EV ${digits}`;
    const petrolPlate = `MH 12 PE ${digits}`;

    // Home: the attention rows, and the garage below them.
    await page.goto('/home');
    await expect(page.getByTestId('attention-row').first()).toBeVisible();
    await expectGreenPlate(page.locator('main'), evPlate, 'Home');
    await expect(
      page.locator('[data-slot="number-plate"]').filter({ hasText: petrolPlate }).first(),
    ).toHaveAttribute('data-variant', 'private');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/ev-home-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Upcoming.
    await page.goto('/upcoming');
    await expect(page.getByTestId('upcoming-row').first()).toBeVisible();
    await expectGreenPlate(page.locator('main'), evPlate, 'Upcoming');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/ev-upcoming-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Quick log's vehicle picker.
    await page.goto('/home');
    const logButton =
      viewport.width < 768
        ? page.getByTestId('bottom-nav').getByRole('button', { name: 'Log' })
        : page.getByRole('main').getByRole('button', { name: 'Log', exact: true });
    await logButton.click();
    await page
      .getByRole('dialog', { name: 'Log' })
      .getByRole('button', { name: 'Log fuel' })
      .click();
    await expectGreenPlate(
      page.getByRole('dialog', { name: 'Which vehicle?' }),
      evPlate,
      'Quick log',
    );
    await page.keyboard.press('Escape');

    // Costs: spend per vehicle.
    await page.goto('/costs');
    await expectGreenPlate(page.locator('main'), evPlate, 'Costs');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/ev-costs-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

/** Phone widths from the smallest in use to the largest before the tablet layout. */
const WIDTHS = [320, 360, 375, 390, 414, 430] as const;

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

async function expectNoSidewaysScroll(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.page, `${label}: the page is ${widths.page} px wide`).toBeLessThanOrEqual(
    widths.viewport,
  );
}

/**
 * #364: Home with four vehicles and Costs with spend, a monthly chart and a
 * loan fit a phone at every width. Home's garage strip scrolls inside itself
 * (its plates' screen-reader spellings used to escape it), and Costs' hidden
 * chart table no longer lays itself out at full width.
 */
test('Home and Costs fit every phone width with a full garage', async ({ page }) => {
  test.slow();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const digits = suffix.slice(-4);
  await registerAndSignIn(page, {
    name: `E2E Overflow ${suffix}`,
    email: `e2e+overflow${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const ids: string[] = [];
  for (const [index, nickname] of [
    'Family SUV',
    'Daily Hatch',
    'Weekend Bike',
    'Second Car',
  ].entries()) {
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12O${'ABCD'[index]}${digits}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2023,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 15000 + index * 1000,
      nickname: `${nickname} ${digits}`,
    });
    ids.push(vehicle.id);
    await post(page, `fuel-logs/vehicle/${vehicle.id}`, {
      date: daysFromNow(-40 - index * 30),
      odometer: 14500 + index * 1000,
      quantity: 30,
      price: 104,
      totalCost: 3120,
    });
    await post(page, `vehicles/${vehicle.id}/maintenance-records`, {
      category: 'periodic_service',
      status: 'confirmed',
      serviceDate: daysFromNow(-90 - index * 20),
      odometer: 14000 + index * 1000,
      totalCost: 4200 + index * 500,
    });
  }
  await post(page, `vehicle-loans/vehicle/${ids[0]}`, {
    lender: 'HDFC Bank',
    principal: 500_000,
    interestRate: 9,
    tenureMonths: 60,
    startDate: daysFromNow(-400),
  });

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 844 });

    await page.goto('/home');
    await expect(page.getByTestId('garage-chip')).toHaveCount(4);
    await expectNoSidewaysScroll(page, `Home at ${width}px`);
    // The strip itself still scrolls to reach the last vehicle.
    const strip = page.getByTestId('garage-strip');
    expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    await page.goto('/costs');
    await expect(page.getByRole('heading', { name: 'Loans' })).toBeVisible();
    await expectNoSidewaysScroll(page, `Costs at ${width}px`);

    if (SHOTS && width === 390) {
      await page.screenshot({
        path: `${SHOTS}/costs-390.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.goto('/home');
      await page.screenshot({
        path: `${SHOTS}/home-390.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

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
 * #325: a vehicle's History tab lists the same History list as the garage's
 * History page, with the vehicle and services preset. Search finds services by
 * category, workshop and notes (and fills by station on the History page), is
 * kept in the URL, and Select deletes services in bulk.
 */
test("the vehicle's service log is the History list, with search and bulk delete", async ({
  page,
}) => {
  test.slow();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nickname = `Log ${suffix.slice(-4)}`;

  await page.setViewportSize(DESKTOP);
  await registerAndSignIn(page, {
    name: `E2E Log ${suffix}`,
    email: `e2e+log${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '18500',
    registrationNumber: `MH12HL${suffix.slice(-4)}`,
  });
  const vehicleId = vehicleUrl.split('/').pop()!;

  await post(page, `vehicles/${vehicleId}/maintenance-records`, {
    category: 'engine_oil',
    serviceDate: daysFromNow(-10),
    odometer: 18_300,
    totalCost: 1850,
    workshopName: 'Torque Garage',
  });
  await post(page, `vehicles/${vehicleId}/maintenance-records`, {
    category: 'periodic_service',
    serviceDate: daysFromNow(-60),
    odometer: 15_200,
    totalCost: 6400,
    workshopName: 'City Hyundai',
    notes: 'Wiper blades replaced under warranty',
  });
  await post(page, `fuel-logs/vehicle/${vehicleId}`, {
    date: daysFromNow(-5),
    odometer: 18_450,
    quantity: 35,
    price: 105,
    totalCost: 3675,
    location: 'HP Baner',
  });

  for (const size of [DESKTOP, PHONE]) {
    await page.setViewportSize(size);
    const label = `${size.width}px`;

    // The tab's service log: both services, in the History list's rows.
    await page.goto(`${vehicleUrl}?tab=history`);
    const log = page.getByTestId('vehicle-service-history');
    await expect(log.getByTestId('history-row'), label).toHaveCount(2);
    await expect(log.getByTestId('history-month').first(), label).toBeVisible();

    // Notes are searched too, and the search is kept in the URL.
    await log.getByRole('searchbox', { name: 'Search history' }).fill('wiper');
    await expect(page, label).toHaveURL(/search=wiper/);
    await expect(log.getByTestId('history-row'), label).toHaveCount(1);
    await expect(log.getByTestId('history-row'), label).toContainText('Periodic service');
    await page.reload();
    await expect(log.getByRole('searchbox', { name: 'Search history' }), label).toHaveValue(
      'wiper',
    );
    await expect(log.getByTestId('history-row'), label).toHaveCount(1);
    await expectNoSidewaysScroll(page, `vehicle tab at ${label}`);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/vehicle-log-search-${size.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // By category, as its label reads.
    await log.getByRole('searchbox', { name: 'Search history' }).fill('engine oil');
    await expect(page, label).toHaveURL(/search=engine(\+|%20)oil/);
    await expect(log.getByTestId('history-row'), label).toHaveCount(1);
    await expect(log.getByTestId('history-row'), label).toContainText('Torque Garage');

    // The History page searches fills by their station.
    await page.goto('/history?search=baner');
    await expect(page.getByTestId('history-row'), label).toHaveCount(1);
    await expect(page.getByTestId('history-row'), label).toContainText('HP Baner');
    await expectNoSidewaysScroll(page, `History page at ${label}`);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/history-search-${size.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
  }

  // Select mode on the tab: services take a checkbox and delete together.
  await page.setViewportSize(DESKTOP);
  await page.goto(`${vehicleUrl}?tab=history`);
  const log = page.getByTestId('vehicle-service-history');
  await log.getByRole('button', { name: 'Select' }).click();
  await log.getByRole('checkbox', { name: /Select Engine oil/ }).check();
  await expect(log.getByText('1 record selected')).toBeVisible();
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/vehicle-log-select-1440.png`,
      fullPage: true,
      animations: 'disabled',
    });
  await log.getByRole('button', { name: 'Delete selected (1)' }).click();
  await page.getByRole('button', { name: 'Delete 1 record' }).click();
  await expect(log.getByTestId('history-row')).toHaveCount(1);
  await expect(log.getByTestId('history-row')).toContainText('Periodic service');
  await expect(log.getByRole('button', { name: 'Select' })).toBeVisible();
  expect(
    await prisma.maintenanceRecord.count({ where: { vehicleId, workshopName: 'Torque Garage' } }),
  ).toBe(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

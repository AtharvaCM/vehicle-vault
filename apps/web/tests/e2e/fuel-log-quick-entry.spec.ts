import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

type Fill = { amount: string; quantity: string; odometer: string };

/**
 * The redesigned add-fill dialog: amount paid, quantity and odometer, in that
 * order, nothing else touched. "More details" (date, station, price, payment,
 * notes) is left collapsed — a same-day fill needs none of it. See issue #294.
 */
async function logFillWithThreeFields(page: Page, fill: Fill) {
  await page.getByRole('button', { name: 'Log fuel' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Amount paid').fill(fill.amount);
  await dialog.getByLabel(/^Quantity/).fill(fill.quantity);
  await dialog.getByLabel('Odometer (km)').fill(fill.odometer);

  // More details never opens: station, date and price stay exactly where they defaulted.
  await expect(dialog.getByLabel('Station')).not.toBeVisible();
  await expect(dialog.getByRole('button', { name: 'More details' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Save fuel' }).click();
  await expect(dialog).toBeHidden();
}

test('logs a fill on a phone with only the three fields', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Fuel Phone ${suffix.slice(-4)}`;
  await page.setViewportSize(PHONE);

  await registerAndSignIn(page, {
    name: `E2E Fuel Phone ${suffix}`,
    email: `e2e+fuelphone${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12FP${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();

  await page.goto(`${vehicleUrl}?tab=history&view=fuel`);
  await logFillWithThreeFields(page, { amount: '900', quantity: '9', odometer: '15300' });

  await expect(page.getByTestId('fuel-row').getByText('9 L', { exact: true })).toBeVisible();

  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const log = await prisma.fuelLog.findFirstOrThrow({ where: { vehicleId: vehicle.id } });
  expect(log.odometer).toBe(15_300);
  expect(Number(log.totalCost)).toBe(900);
  expect(log.quantity).toBe(9);
  // Left at its default: a liquid fuel's fill is assumed full unless told otherwise.
  expect(log.isFullTank).toBe(true);
});

test('logs a fill with only the three fields at desktop width too', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Fuel Desktop ${suffix.slice(-4)}`;
  await page.setViewportSize(DESKTOP);

  await registerAndSignIn(page, {
    name: `E2E Fuel Desktop ${suffix}`,
    email: `e2e+fueldesktop${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '20000',
    registrationNumber: `MH12FD${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();

  await page.goto(`${vehicleUrl}?tab=history&view=fuel`);
  await logFillWithThreeFields(page, { amount: '1050', quantity: '10', odometer: '20450' });

  await expect(page.getByTestId('fuel-row').getByText('10 L', { exact: true })).toBeVisible();

  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const log = await prisma.fuelLog.findFirstOrThrow({ where: { vehicleId: vehicle.id } });
  expect(log.odometer).toBe(20_450);
  expect(Number(log.totalCost)).toBe(1050);
  expect(log.quantity).toBe(10);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

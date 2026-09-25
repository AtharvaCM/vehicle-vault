import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Stored enum values that must never reach the screen as they are: every value
 * goes through `format.enumLabel` ("petrol" → "Petrol", "engine_oil" →
 * "Engine oil", "road_tax" → "Road tax").
 */
const RAW_VALUES = [
  'petrol',
  'diesel',
  'cng',
  'suv',
  'car',
  'motorcycle',
  'engine_oil',
  'periodic_service',
  'road_tax',
  'puc',
  'registration',
  'insurance',
  'owner',
  'manual',
  'confirmed',
];

/**
 * The leaf elements whose own text is a raw enum value. `textContent` is read
 * rather than `innerText` so a CSS `capitalize` or `uppercase` cannot disguise
 * one.
 */
async function rawEnumTexts(page: Page) {
  return page.locator('main').evaluate((main, raw) => {
    const values = new Set(raw);

    return [...main.querySelectorAll('*')]
      .filter((element) => element.children.length === 0)
      .map((element) => (element.textContent ?? '').trim())
      .filter((text) => values.has(text) || /\b[a-z]+_[a-z_]+\b/.test(text));
  }, RAW_VALUES);
}

test('vehicle header, service records and papers show labels, not raw enum values', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const nickname = `Labels ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Labels ${suffix}`,
    email: `e2e+labels${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12EL${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  await prisma.maintenanceRecord.create({
    data: {
      vehicleId: vehicle.id,
      serviceDate: new Date('2026-05-02'),
      odometer: 14_200,
      category: 'engine_oil',
      totalCost: 131_624,
    },
  });
  await prisma.complianceDocument.create({
    data: {
      vehicleId: vehicle.id,
      kind: 'road_tax',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2031-01-01'),
      amount: 12_500,
    },
  });

  // The vehicle page shows no raw enum, and the garage names its type in words.
  await page.goto(vehicleUrl);
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();
  expect(await rawEnumTexts(page)).toEqual([]);
  await page.goto('/garage');
  await expect(page.getByText('SUV', { exact: true }).first()).toBeVisible();
  expect(await rawEnumTexts(page)).toEqual([]);

  // The service list gives the category a label, and money in Indian grouping.
  await page.goto(`${vehicleUrl}?tab=history`);
  await expect(page.getByText('Engine oil', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('₹1,31,624').first()).toBeVisible();
  expect(await rawEnumTexts(page)).toEqual([]);

  await page.goto('/history');
  await expect(page.getByText('Engine oil', { exact: true }).first()).toBeVisible();
  expect(await rawEnumTexts(page)).toEqual([]);

  // Papers carry the one date style.
  await page.goto(`${vehicleUrl}?tab=papers`);
  await expect(page.getByText('1 Jan 2031').first()).toBeVisible();
  expect(await rawEnumTexts(page)).toEqual([]);
});

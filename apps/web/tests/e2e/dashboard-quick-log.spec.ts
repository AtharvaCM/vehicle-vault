import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** On a phone, Home's writes are behind the bottom bar's ＋ (#306). */
async function openLog(page: Page, action: 'Log service' | 'Log fuel') {
  await page.getByTestId('quick-log-button').click();
  await page.getByRole('dialog', { name: 'Log' }).getByRole('button', { name: action }).click();
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const jobCard = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample-receipt.pdf',
);

/**
 * A service logged at the workshop counter, on a phone: date, odometer, cost
 * and a photo, and it saves what issue #116 decided — a confirmed record in
 * category `other`, the odometer raised only when higher, the photo attached.
 * A fuel fill starts from the same place in one tap.
 */
test('a service and a fuel fill are logged from the dashboard on a phone', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Quick ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Quick ${suffix}`,
    email: `e2e+quick${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12QL${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/home');

  await openLog(page, 'Log service');
  const dialog = page.getByRole('dialog', { name: 'Log a service' });
  await expect(dialog.getByLabel('Odometer (km)')).toHaveValue('15000');
  await dialog.getByLabel('Odometer (km)').fill('15200');
  await dialog.getByLabel('Cost').fill('1500');
  await dialog.getByLabel('Photo').setInputFiles(jobCard);
  await dialog.getByRole('button', { name: 'Log service' }).click();
  await expect(dialog).toBeHidden();

  const record = await prisma.maintenanceRecord.findFirstOrThrow({
    where: { vehicleId: vehicle.id },
    include: { attachments: true },
  });
  expect(record).toMatchObject({
    category: 'other',
    status: 'confirmed',
    odometer: 15200,
  });
  expect(Number(record.totalCost)).toBe(1500);
  expect(record.attachments).toHaveLength(1);
  expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).odometer).toBe(
    15200,
  );

  // A back-dated log from an older bill never winds the odometer back.
  await openLog(page, 'Log service');
  await dialog.getByLabel('Odometer (km)').fill('14000');
  await dialog.getByLabel('Cost').fill('300');
  await dialog.getByRole('button', { name: 'Log service' }).click();
  await expect(dialog).toBeHidden();
  expect(await prisma.maintenanceRecord.count({ where: { vehicleId: vehicle.id } })).toBe(2);
  expect((await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).odometer).toBe(
    15200,
  );

  // Fuel, one tap from the same place: amount, quantity, odometer — nothing else.
  await openLog(page, 'Log fuel');
  const fuel = page.getByRole('dialog', { name: 'Log fuel' });
  await fuel.getByLabel('Amount paid').fill('2100');
  await fuel.getByLabel(/^Quantity/).fill('20');
  await fuel.getByLabel('Odometer (km)').fill('15260');
  await fuel.getByRole('button', { name: 'Save fuel' }).click();
  await expect(fuel).toBeHidden();
  expect(await prisma.fuelLog.count({ where: { vehicleId: vehicle.id } })).toBe(1);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 390, height: 844 };

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function signIn(page: Page, label: string) {
  const suffix = uniqueSuffix();
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+${label.toLowerCase()}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  return suffix;
}

/** Fills and saves the fuel form the ＋ sheet opened, then checks the row landed. */
async function logFuel(page: Page, vehicleId: string) {
  const dialog = page.getByRole('dialog', { name: 'Log fuel' });
  await expect(dialog).toBeVisible();
  // The odometer field never prefills, only hints at the vehicle's last reading.
  const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  const reading = vehicle.odometer + 250;
  await dialog.getByLabel('Amount paid').fill('3150');
  await dialog.getByLabel(/litres|quantity/i).fill('30');
  await dialog.getByLabel(/odometer/i).fill(String(reading));
  await dialog.getByRole('button', { name: /save|log fuel/i }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(() => prisma.fuelLog.count({ where: { vehicleId, odometer: reading } }))
    .toBe(1);
}

test('log fuel from the ＋ on a one-vehicle account, with no vehicle to pick', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const suffix = await signIn(page, 'QuickOne');
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname: `Quick One ${suffix.slice(-4)}`,
    odometer: '15200',
    registrationNumber: `MH12QO${suffix.slice(-4)}`,
  });
  const vehicleId = vehicleUrl.split('/').pop()!;

  await page.goto('/home');
  const bar = page.getByTestId('bottom-nav');
  // Home · Garage · ＋ · Upcoming · More, the ＋ in the middle at 52px.
  await expect(bar.getByRole('link')).toHaveText(['Home', 'Garage', 'Upcoming']);
  const plus = bar.getByRole('button', { name: 'Log' });
  const box = (await plus.boundingBox())!;
  expect(Math.round(box.width)).toBe(52);
  expect(Math.round(box.height)).toBe(52);
  const barBox = (await bar.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (barBox.x + barBox.width / 2))).toBeLessThan(2);

  await plus.click();
  const sheet = page.getByRole('dialog', { name: 'Log' });
  await expect(sheet.getByRole('button')).toContainText([
    'Log service',
    'Log fuel',
    'Update odometer',
    'Add paper',
    'Add reminder',
    'Add vehicle',
  ]);
  await sheet.getByRole('button', { name: 'Log fuel' }).click();
  await logFuel(page, vehicleId);
});

test('log fuel from the ＋ with several vehicles: pick one first, viewer-only ones left out', async ({
  page,
}) => {
  test.slow();
  const suffix = await signIn(page, 'QuickMany');
  const first = `Quick A ${suffix.slice(-4)}`;
  const second = `Quick B ${suffix.slice(-4)}`;
  await createCatalogVehicle(page, {
    nickname: first,
    odometer: '15200',
    registrationNumber: `MH12QA${suffix.slice(-4)}`,
  });
  // A fresh load between vehicles, or the form's catalog lists come from cache
  // and the helper waits for requests that never go out.
  await page.goto('/garage');
  const secondUrl = await createCatalogVehicle(page, {
    nickname: second,
    odometer: '8200',
    registrationNumber: `MH12QB${suffix.slice(-4)}`,
  });
  const secondId = secondUrl.split('/').pop()!;
  const viewedName = `Quick V ${suffix.slice(-4)}`;
  await page.goto('/garage');
  const viewedUrl = await createCatalogVehicle(page, {
    nickname: viewedName,
    odometer: '1000',
    registrationNumber: `MH12QV${suffix.slice(-4)}`,
  });
  // This account only views the third one, so nothing can be logged against it.
  await prisma.vehicleMember.updateMany({
    where: { vehicleId: viewedUrl.split('/').pop()! },
    data: { role: 'viewer' },
  });

  await page.setViewportSize(PHONE);
  await page.goto('/home');
  await page.getByTestId('bottom-nav').getByRole('button', { name: 'Log' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log' });
  await sheet.getByRole('button', { name: 'Log fuel' }).click();

  const picker = page.getByRole('dialog', { name: 'Which vehicle?' });
  const vehicles = picker.getByRole('list', { name: 'Vehicles' }).getByRole('button');
  await expect(vehicles).toHaveCount(2);
  await expect(vehicles).toContainText([first, second]);
  await expect(picker.getByText(viewedName)).toHaveCount(0);

  await vehicles.filter({ hasText: second }).click();
  await logFuel(page, secondId);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Issue #202: "Log maintenance" and "Create reminder" used to dump the owner
 * on the vehicle list no matter what, so a single-vehicle account paid three
 * extra taps for the most frequent write. Both actions now open a vehicle
 * picker only when there is something to pick, and land straight on the form
 * otherwise.
 */
test('one vehicle: Log service and Create reminder skip the picker and open the form', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const nickname = `Solo ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Solo ${suffix}`,
    email: `e2e+solo${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '12000',
    registrationNumber: `MH12PK${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  // With exactly one editable vehicle the action is a plain link straight to
  // its form — no picker, no button-then-dialog detour.
  await page.goto('/maintenance');
  await page.getByRole('link', { name: 'Log service', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}/maintenance/new$`));
  await expect(page.getByRole('heading', { name: 'Add service record' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await page.goto('/reminders');
  await page.getByRole('link', { name: 'Create reminder', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}/reminders/new$`));
  await expect(page.getByRole('heading', { name: 'Add Reminder' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('several vehicles: Log service opens a picker, then the chosen form', async ({ page }) => {
  const suffix = uniqueSuffix();
  const firstNickname = `Daily ${suffix.slice(-4)}`;
  const secondNickname = `Weekend ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Multi ${suffix}`,
    email: `e2e+multi${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname: firstNickname,
    odometer: '12000',
    registrationNumber: `MH12PA${suffix.slice(-4)}`,
  });

  await page.goto('/vehicles');
  await createCatalogVehicle(page, {
    nickname: secondNickname,
    odometer: '8000',
    registrationNumber: `MH12PB${suffix.slice(-4)}`,
  });
  const secondVehicle = await prisma.vehicle.findFirstOrThrow({
    where: { nickname: secondNickname },
  });

  await page.goto('/maintenance');
  await page.getByRole('button', { name: 'Log service', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Log service' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: new RegExp(firstNickname) })).toBeVisible();
  await expect(dialog.getByRole('link', { name: new RegExp(secondNickname) })).toBeVisible();

  await dialog.getByRole('link', { name: new RegExp(secondNickname) }).click();

  await expect(page).toHaveURL(new RegExp(`/vehicles/${secondVehicle.id}/maintenance/new$`));
  await expect(page.getByRole('heading', { name: 'Add service record' })).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

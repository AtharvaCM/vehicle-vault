import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * The odometer is what every forecast and alert is measured from, so the most
 * frequent correction in the app is one tap and one number on the dashboard —
 * and it only ever moves forward from there.
 */
test('the odometer is updated from the dashboard health card', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Odo Garage ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Odometer ${suffix}`,
    email: `e2e+odometer${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12OD${suffix.slice(-4)}`,
  });

  await page.goto('/home');
  const card = page.getByTestId('vehicle-health-card').filter({ hasText: nickname });
  await expect(card).toContainText('15,200 km');

  // A lower reading is refused on the card, with the edit form as the way out.
  await card.getByRole('button', { name: `Update odometer for ${nickname}` }).click();
  await page.getByLabel('New reading (km)').fill('15100');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('alert')).toContainText('already reads 15,200 km');
  await expect(page.getByRole('link', { name: 'Edit the vehicle' })).toBeVisible();

  // A higher one saves without leaving the dashboard.
  await page.getByLabel('New reading (km)').fill('15950');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByLabel('New reading (km)')).toBeHidden();
  await expect(page).toHaveURL(/\/home$/);
  await expect(card).toContainText('15,950 km');

  // The API holds the same line as the card.
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  expect(vehicle.odometer).toBe(15950);
  const response = await page.request.patch(`/api/vehicles/${vehicle.id}/odometer`, {
    data: { odometer: 100 },
    headers: {
      Authorization: `Bearer ${await page.evaluate(() => {
        const raw = window.localStorage.getItem('vehicle-vault.auth-session');
        return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
      })}`,
    },
  });
  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('already reads 15,950 km');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

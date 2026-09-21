import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { selectDropdownOption, selectSearchableOption } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Everything up to landing on the newly created vehicle's page. */
async function addVehicle(page: import('@playwright/test').Page, suffix: string) {
  await page
    .getByRole('link', { name: /add vehicle/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);

  await page.getByLabel(/registration number/i).fill(`MH12EX${suffix.slice(-4)}`);
  await selectDropdownOption(page, /^vehicle type$/i, 'SUV');

  const makeOptions = page.waitForResponse(
    (response) => response.url().includes('/api/vehicle-catalog/makes') && response.ok(),
  );
  await page.getByLabel(/^year$/i).fill('2024');
  await page.getByLabel(/^year$/i).press('Tab');
  await makeOptions;

  const modelOptions = page.waitForResponse(
    (response) => response.url().includes('/api/vehicle-catalog/models') && response.ok(),
  );
  await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
  await modelOptions;
  await selectSearchableOption(page, 'vehicle-model', 'Search models...', 'Creta', 'Creta');

  await page.getByLabel('Odometer', { exact: true }).fill('15200');
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
}

/**
 * The two dates an owner knows by heart are the ones the alerts run on, so the
 * new vehicle asks for them straight away rather than waiting for a later visit
 * to the Protection tab.
 */
test('a new vehicle asks for the insurance and PUC expiry, once', async ({ page }) => {
  const suffix = uniqueSuffix();

  await registerAndSignIn(page, {
    name: `E2E Expiry ${suffix}`,
    email: `e2e+expiry${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });

  await addVehicle(page, suffix);

  await expect(page.getByText('Never miss a renewal')).toBeVisible();
  await page.getByLabel('Insurance expires on').fill('2027-03-01');
  await page.getByLabel('PUC expires on').fill('2026-12-15');
  await page.getByRole('button', { name: 'Save dates' }).click();

  // Answering puts the prompt away for good.
  await expect(page.getByText('Never miss a renewal')).toBeHidden();
  await page.reload();
  await expect(page.getByText('Never miss a renewal')).toBeHidden();

  // Both records exist, each known by its expiry alone.
  await page.getByRole('tab', { name: 'Protection' }).click();
  await expect(page.getByText('01 Mar 2027')).toBeVisible();
  await expect(page.getByText('15 Dec 2026')).toBeVisible();
  await expect(page.getByText('Not recorded').first()).toBeVisible();
});

test('the prompt can be skipped in one click and does not come back', async ({ page }) => {
  const suffix = uniqueSuffix();

  await registerAndSignIn(page, {
    name: `E2E Skip ${suffix}`,
    email: `e2e+skip${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });

  await addVehicle(page, suffix);

  await expect(page.getByText('Never miss a renewal')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();

  await expect(page.getByText('Never miss a renewal')).toBeHidden();
  await page.reload();
  await expect(page.getByText('Never miss a renewal')).toBeHidden();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

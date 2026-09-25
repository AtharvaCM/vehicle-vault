import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import {
  selectDropdownOption,
  selectSearchableOption,
  skipVehicleSetupPrompt,
} from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Naming the exact trim is the step most likely to stall someone adding their
 * first vehicle, so the form has to let them past it — and everything after has
 * to read properly without one.
 */
test('a vehicle can be added without naming its variant', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `No Variant ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E NoVariant ${suffix}`,
    email: `e2e+novariant${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });

  await page
    .getByRole('link', { name: /add vehicle/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);

  await page.getByLabel(/registration number/i).fill(`MH12NV${suffix.slice(-4)}`);
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

  // The variant picker is offered and deliberately left alone.
  await expect(page.getByText('Variant (optional)')).toBeVisible();
  await page.getByLabel('Odometer', { exact: true }).fill('15200');
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await skipVehicleSetupPrompt(page);
  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();
  // Make and model, with no gap where the variant would have been.
  await expect(
    page.getByText('Hyundai Creta · 15,200 km, updated today', { exact: true }),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('link', { name: 'Tech specs' }).click();
  await expect(page.getByText('No variant on file')).toBeVisible();

  // The trim can be filled in later, from the same form.
  await page.getByRole('button', { name: 'More vehicle actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit vehicle' }).click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/edit$/);
  await expect(page.locator('#vehicle-variant')).toContainText('Select variant, or skip');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

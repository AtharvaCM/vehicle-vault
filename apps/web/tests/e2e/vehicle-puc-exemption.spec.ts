import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { selectDropdownOption, selectSearchableOption } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * A PUC test measures what comes out of a tailpipe, so an electric vehicle is
 * exempt, and nothing should ask it for one: not the new-vehicle prompt, not
 * the dashboard's documents row, not the Papers tab.
 */
test('an electric vehicle is never asked for a PUC certificate', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `EV ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E EV ${suffix}`,
    email: `e2e+ev${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });

  await page
    .getByRole('link', { name: /add vehicle/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await page.getByLabel(/registration number/i).fill(`MH12EV${suffix.slice(-4)}`);
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
  // With no variant picked, every fuel is on offer.
  await selectDropdownOption(page, /^fuel type$/i, 'Electric');
  await page.getByLabel('Odometer', { exact: true }).fill('8200');
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  // The new-vehicle prompt asks for the insurance date alone, before the
  // page ever leaves /vehicles/new for the vehicle itself.
  await expect(page.getByText('Never miss a renewal')).toBeVisible();
  await expect(page.getByLabel('PUC expires on')).toHaveCount(0);
  await page.getByLabel('Insurance expires on').fill('2027-03-01');
  await page.getByRole('button', { name: 'Save dates' }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByText('Never miss a renewal')).toBeHidden();

  // With its insurance on file, Home's summary row reads its papers as in order.
  await page.goto('/home');
  const card = page.getByTestId('vehicle-summary-row').filter({ hasText: nickname });
  const documents = card.getByRole('link', { name: 'Insurance valid · to 1 Mar 2027' });
  await expect(documents).toBeVisible();
  await expect(card).not.toContainText('PUC');

  // The row opens the Papers tab, which points it at its RC instead.
  await documents.click();
  await expect(page.getByText('Electric vehicles are exempt from PUC')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add RC' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add road tax' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add PUC' })).toHaveCount(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

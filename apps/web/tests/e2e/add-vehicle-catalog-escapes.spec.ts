import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { selectSearchableOption } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function startAddingACar(page: import('@playwright/test').Page, label: string) {
  const suffix = uniqueSuffix();

  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+addvehicle${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await page
    .getByRole('link', { name: /add vehicle/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  // The type stays at its default, Car: most owners call a Creta "a car".
  await expect(page.getByLabel(/^vehicle type$/i)).toContainText('Car');
  await page.getByLabel(/registration number/i).fill(`MH12AV${suffix.slice(-4)}`);

  const makes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/vehicle-catalog/makes') &&
      response.url().includes('year=2024') &&
      response.ok(),
  );
  await page.getByLabel(/^year$/i).fill('2024');
  await page.getByLabel(/^year$/i).press('Tab');
  await makes;

  return `E2E ${label} ${suffix.slice(-4)}`;
}

/**
 * The Creta is filed under SUV. Searching it with the type left at Car used to
 * answer "No models found for this make"; it is now found, and choosing it
 * takes the catalog's type while keeping the make.
 */
test('a model filed under SUV is found from Car and takes its type', async ({ page }) => {
  const nickname = await startAddingACar(page, 'Creta');

  const models = page.waitForResponse(
    (response) =>
      response.url().includes('/api/vehicle-catalog/models') &&
      response.url().includes('make=Hyundai') &&
      response.url().includes('vehicleType=suv') &&
      response.ok(),
  );
  await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
  await models;
  // Not the shared helper: once chosen, the option is the SUV's own and the
  // trigger reads plain "Creta" rather than the label it was picked by.
  await page.locator('#vehicle-model').click();
  const modelList = page.locator('#vehicle-model-content');
  await modelList.getByPlaceholder('Search models...').fill('creta');
  await modelList.locator('[cmdk-item]').filter({ hasText: 'Creta · listed under SUV' }).click();

  await expect(page.getByLabel(/^vehicle type$/i)).toContainText('SUV');
  await expect(page.locator('#vehicle-make')).toContainText('Hyundai');
  await expect(page.locator('#vehicle-model')).toContainText('Creta');

  await page.getByLabel('Odometer', { exact: true }).fill('1200');
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

  const saved = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  expect(saved).toMatchObject({ vehicleType: 'suv', make: 'Hyundai', model: 'Creta' });
});

test('a make the catalog lacks is entered by hand and saved with the chosen type', async ({
  page,
}) => {
  const nickname = await startAddingACar(page, 'Manual');

  await page.locator('#vehicle-make').click();
  const content = page.locator('#vehicle-make-content');
  await content.getByPlaceholder('Search makes...').fill('Ather');
  await content.getByText(`Can't find it? Enter "Ather" manually`).click();

  await expect(page.getByLabel('Make')).toHaveValue('Ather');
  await page.getByLabel('Model').fill('450X');
  await page.getByLabel('Odometer', { exact: true }).fill('800');
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

  const saved = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  expect(saved).toMatchObject({ vehicleType: 'car', make: 'Ather', model: '450X' });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

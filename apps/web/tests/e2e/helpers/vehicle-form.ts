import { expect, type Page } from '@playwright/test';

/**
 * Make/model/variant are catalog-backed comboboxes, not free-text inputs: the
 * trigger opens a popover, the search box filters, and the option has to be
 * clicked. Each selection also refetches the next level of the catalog.
 */
export async function selectSearchableOption(
  page: Page,
  fieldId: string,
  searchPlaceholder: string,
  searchValue: string,
  optionLabel: string,
) {
  const trigger = page.locator(`#${fieldId}`);
  await trigger.click();

  const content = page.locator(`#${fieldId}-content`);
  await expect(content).toBeVisible();
  await content.getByPlaceholder(searchPlaceholder).fill(searchValue);
  await expect(content.locator('[cmdk-item]').filter({ hasText: optionLabel }).first()).toBeVisible(
    {
      timeout: 15000,
    },
  );
  await content.locator('[cmdk-item]').filter({ hasText: optionLabel }).first().click();
  await expect(trigger).toContainText(optionLabel);
}

export async function selectDropdownOption(page: Page, fieldLabel: RegExp, optionLabel: string) {
  await page.getByLabel(fieldLabel).click();
  await page.getByRole('option', { name: optionLabel }).click();
  await expect(page.getByLabel(fieldLabel)).toContainText(optionLabel);
}

type CatalogVehicle = {
  nickname: string;
  odometer: string;
  registrationNumber: string;
};

/**
 * Creates a Hyundai Creta SX from the seeded India catalog and returns the
 * vehicle detail URL. Awaits each catalog request so the next combobox is
 * populated before it is opened.
 */
export async function createCatalogVehicle(
  page: Page,
  { nickname, odometer, registrationNumber }: CatalogVehicle,
) {
  await page
    .getByRole('link', { name: /add vehicle/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);

  await page.getByLabel(/registration number/i).fill(registrationNumber);
  await selectDropdownOption(page, /^vehicle type$/i, 'SUV');

  const makeOptionsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/vehicle-catalog/makes') &&
      response.url().includes('vehicleType=suv') &&
      response.url().includes('year=2024') &&
      response.ok(),
  );
  await page.getByLabel(/^year$/i).fill('2024');
  await page.getByLabel(/^year$/i).press('Tab');
  await makeOptionsResponse;

  const modelOptionsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/vehicle-catalog/models') &&
      response.url().includes('make=Hyundai') &&
      response.ok(),
  );
  await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
  await modelOptionsResponse;

  const variantOptionsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/vehicle-catalog/variants') &&
      response.url().includes('make=Hyundai') &&
      response.url().includes('model=Creta') &&
      response.ok(),
  );
  await selectSearchableOption(page, 'vehicle-model', 'Search models...', 'Creta', 'Creta');
  await variantOptionsResponse;

  await selectSearchableOption(page, 'vehicle-variant', 'Search variants...', 'SX', 'SX');
  await page.getByLabel('Odometer', { exact: true }).fill(odometer);
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

  return page.url();
}

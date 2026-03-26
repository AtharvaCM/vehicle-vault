import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function selectSearchableOption(
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

async function selectDropdownOption(page: Page, fieldLabel: RegExp, optionLabel: string) {
  await page.getByLabel(fieldLabel).click();
  await page.getByRole('option', { name: optionLabel }).click();
  await expect(page.getByLabel(fieldLabel)).toContainText(optionLabel);
}

test('user can register, sign in, and manage the core garage flow', async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `E2E User ${suffix}`;
  const email = `e2e+${suffix}@vehiclevault.dev`;
  const password = 'VehicleVault!234';
  const registrationNumber = `MH12VV${suffix.slice(-4)}`;
  const initialNickname = `Garage ${suffix.slice(-4)}`;
  const updatedNickname = `Garage ${suffix.slice(-4)} Prime`;
  const workshopName = `Workshop ${suffix.slice(-4)}`;
  const updatedWorkshopName = `Workshop ${suffix.slice(-4)} Prime`;
  const reminderTitle = `Insurance renewal ${suffix.slice(-4)}`;
  const updatedReminderTitle = `Insurance renewed ${suffix.slice(-4)}`;
  const receiptPath = path.join(__dirname, 'fixtures', 'sample-receipt.pdf');

  await page.goto('/register');

  await page.getByLabel(/^name$/i).fill(name);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('menuitem', { name: /logout/i }).click();

  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

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
  await page.getByLabel(/odometer/i).fill('15200');
  await page.getByLabel(/nickname/i).fill(initialNickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: initialNickname })).toBeVisible();

  const vehicleUrl = page.url();

  await page.getByRole('link', { name: /edit vehicle/i }).click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/edit$/);
  await expect(page.locator('#vehicle-type')).toContainText('SUV');
  await expect(page.locator('#vehicle-make')).toContainText('Hyundai');
  await expect(page.locator('#vehicle-model')).toContainText('Creta');
  await expect(page.locator('#vehicle-variant')).toContainText('SX');
  await page.getByLabel(/nickname/i).fill(updatedNickname);
  await page.getByLabel(/odometer/i).fill('16250');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: updatedNickname })).toBeVisible();
  await expect(page.getByText('Odometer: 16,250 km')).toBeVisible();

  await page
    .getByRole('link', { name: /^add maintenance$/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/maintenance\/new$/);
  await page.getByLabel(/service date/i).fill('2026-03-20');
  await page.getByLabel(/^odometer$/i).fill('16250');
  await page.getByLabel(/workshop or garage/i).fill(workshopName);
  await page.getByLabel(/total cost/i).fill('4500');
  await page.getByLabel(/notes/i).fill('Oil change and general inspection');
  await page.getByRole('button', { name: /save record/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/maintenance$/);
  await page.getByRole('link', { name: new RegExp(workshopName) }).click();

  await expect(page).toHaveURL(/\/maintenance-records\/[^/]+$/);
  await expect(page.getByText(workshopName)).toBeVisible();

  await page.getByRole('link', { name: /edit record/i }).click();
  await expect(page).toHaveURL(/\/maintenance-records\/[^/]+\/edit$/);
  await page.getByLabel(/workshop or garage/i).fill(updatedWorkshopName);
  await page.getByLabel(/notes/i).fill('Updated record after reviewing invoice');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/maintenance-records\/[^/]+$/);
  await expect(page.getByText(updatedWorkshopName)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(receiptPath);
  await expect(page.getByText('sample-receipt.pdf')).toBeVisible();

  await page.goto(vehicleUrl);
  await expect(page.getByRole('heading', { name: updatedNickname })).toBeVisible();

  await page
    .getByRole('link', { name: /^add reminder$/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/reminders\/new$/);
  await page.getByLabel(/^title$/i).fill(reminderTitle);
  await page.getByLabel(/due date/i).fill('2026-04-20');
  await page.getByLabel(/notes/i).fill('Renew before expiry');
  await page.getByRole('button', { name: /save reminder/i }).click();

  await expect(page).toHaveURL(/\/reminders\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: reminderTitle })).toBeVisible();

  await page.getByRole('link', { name: /edit reminder/i }).click();
  await expect(page).toHaveURL(/\/reminders\/[^/]+\/edit$/);
  await page.getByLabel(/^title$/i).fill(updatedReminderTitle);
  await page.getByLabel(/notes/i).fill('Updated after confirming the policy renewal timeline');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page).toHaveURL(/\/reminders\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: updatedReminderTitle })).toBeVisible();
});

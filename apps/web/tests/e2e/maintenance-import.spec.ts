import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiWorkspacePath = path.resolve(__dirname, '../../../api');
const apiEnvPath = path.join(apiWorkspacePath, '.env');
const requireFromApi = createRequire(import.meta.url);
const { PrismaClient } = requireFromApi(
  path.join(apiWorkspacePath, 'node_modules/@prisma/client'),
);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: readEnvValue(apiEnvPath, 'DATABASE_URL'),
    },
  },
});

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function readEnvValue(filePath: string, key: string) {
  const contents = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const currentKey = line.slice(0, separatorIndex).trim();

    if (currentKey !== key) {
      continue;
    }

    return line.slice(separatorIndex + 1).trim();
  }

  throw new Error(`Missing ${key} in ${filePath}`);
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

async function markUserEmailVerified(email: string) {
  await prisma.user.update({
    where: {
      email: email.toLowerCase(),
    },
    data: {
      emailVerified: true,
      emailVerificationTokenHash: null,
    },
  });
}

async function registerAndCreateVehicle(page: Page) {
  const suffix = uniqueSuffix();
  const name = `E2E Import User ${suffix}`;
  const email = `e2e-import+${suffix}@vehiclevault.dev`;
  const password = 'VehicleVault!234';
  const registrationNumber = `MH14VV${suffix.slice(-4)}`;
  const nickname = `Import Garage ${suffix.slice(-4)}`;

  await page.goto('/register');

  await page.getByLabel(/^name$/i).fill(name);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();

  await expect(page.getByRole('heading', { name: /verify your email/i })).toBeVisible();
  await markUserEmailVerified(email);

  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: /add vehicle/i }).first().click();
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
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

  return { nickname, vehicleUrl: page.url() };
}

test('user can import grouped maintenance CSV rows into a structured record', async ({ page }) => {
  const csvPath = path.join(__dirname, 'fixtures', 'sample-maintenance-import.csv');
  const { nickname, vehicleUrl } = await registerAndCreateVehicle(page);

  await page.goto(`${vehicleUrl}/maintenance`);
  await expect(page.getByRole('heading', { name: `${nickname} Maintenance` })).toBeVisible();

  await page.getByRole('button', { name: /import csv/i }).first().click();
  await expect(page.getByRole('dialog', { name: /import maintenance csv/i })).toBeVisible();

  await page.locator('#maintenance-import-upload').setInputFiles(csvPath);
  await expect(page.getByText('Column mapping')).toBeVisible();
  await expect(page.getByText('2 rows detected')).toBeVisible();

  await page.getByRole('button', { name: /preview import/i }).click();
  await expect(page.getByText('Ready to import')).toBeVisible();
  await expect(page.getByText('1 maintenance record will be created.')).toBeVisible();
  await expect(page.getByText('Torque Garage')).toBeVisible();
  await expect(page.getByText('₹1,850')).toBeVisible();

  const bulkImportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/maintenance-records/bulk') &&
      response.request().method() === 'POST' &&
      response.ok(),
  );
  await page.getByRole('button', { name: /import records/i }).click();
  await bulkImportResponse;

  await expect(page.getByRole('dialog', { name: /import maintenance csv/i })).toBeHidden();
  const importedRecord = page.getByRole('link', { name: /torque garage/i }).first();
  await expect(importedRecord).toBeVisible();
  await expect(page.getByText('Invoice INV-IMPORT-001')).toBeVisible();
  await expect(importedRecord).toContainText('2 items');

  await importedRecord.click();
  await expect(page).toHaveURL(/\/maintenance-records\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Engine Oil' })).toBeVisible();
  await expect(page.getByText('INV-IMPORT-001')).toBeVisible();
  await expect(page.getByText('Oil Filter', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('₹1,400', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('₹450', { exact: true }).first()).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test('user can manage insurance and warranty documents via unified route', async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `E2E Docs ${suffix}`;
  const email = `e2edocs+${suffix}@vehiclevault.dev`;
  const password = 'VehicleVault!234';
  const registrationNumber = `MH12DC${suffix.slice(-4)}`;

  // ── 1. Register & Setup Vehicle ────────────────────────────────────
  await registerAndSignIn(page, { email, name, password });

  await createCatalogVehicle(page, {
    nickname: `Docs Garage ${suffix.slice(-4)}`,
    odometer: '1000',
    registrationNumber,
  });

  // ── 2. Go to Protection Tab ────────────────────────────────────────
  await page.getByRole('tab', { name: /protection/i }).click();

  // ── 3. Create Insurance ────────────────────────────────────────────
  await page.getByRole('button', { name: 'Add Policy', exact: true }).click();
  await expect(page.getByRole('heading', { name: /add insurance policy/i })).toBeVisible();
  await page.getByLabel(/provider name/i).fill('Test Insurance Corp');
  await page.getByLabel(/policy number/i).fill('INS12345');
  await page.getByLabel(/start date/i).fill('2026-01-01');
  await page.getByLabel(/end date/i).fill('2027-01-01');
  await page.getByLabel(/premium amount/i).fill('15000');
  await page.getByRole('button', { name: /add policy/i }).click();

  // Verify the insurance card appeared (list works)
  await expect(page.getByText('Test Insurance Corp')).toBeVisible();
  await expect(page.getByText('#INS12345')).toBeVisible();

  // ── 4. Create Warranty ─────────────────────────────────────────────
  await page.getByRole('button', { name: 'Add Warranty', exact: true }).click();
  await expect(page.getByRole('heading', { name: /add warranty coverage/i })).toBeVisible();
  await page.getByLabel(/provider\/brand/i).fill('Test Motors Warranty');
  await page.getByLabel(/warranty #/i).fill('WAR98765');
  await page.getByLabel(/start date/i).fill('2026-01-01');
  await page.getByLabel(/end odometer/i).fill('100000');
  await page.getByRole('button', { name: /add warranty/i }).click();

  // Verify the warranty card appeared
  await expect(page.getByText('Test Motors Warranty')).toBeVisible();
  await expect(page.getByText('#WAR98765')).toBeVisible();

  // ── 5. Edit Insurance ──────────────────────────────────────────────
  // Click the pencil (edit) button on the insurance card
  const insuranceCard = page.locator('[class*="border-slate"]').filter({ hasText: 'Test Insurance Corp' });
  await insuranceCard.getByRole('button').first().click(); // Pencil is first, Trash is second
  await expect(page.getByRole('heading', { name: /edit insurance policy/i })).toBeVisible();
  // Change the provider name
  await page.getByLabel(/provider name/i).clear();
  await page.getByLabel(/provider name/i).fill('Updated Insurance Corp');
  await page.getByRole('button', { name: /save changes/i }).click();

  // Verify the updated name appears
  await expect(page.getByText('Updated Insurance Corp')).toBeVisible();

  // ── 6. Edit Warranty ───────────────────────────────────────────────
  const warrantyCard = page.locator('[class*="border-slate"]').filter({ hasText: 'Test Motors Warranty' });
  await warrantyCard.getByRole('button').first().click();
  await expect(page.getByRole('heading', { name: /edit warranty coverage/i })).toBeVisible();
  await page.getByLabel(/provider\/brand/i).clear();
  await page.getByLabel(/provider\/brand/i).fill('Updated Motors Warranty');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByText('Updated Motors Warranty')).toBeVisible();

  // ── 7. Delete Both ─────────────────────────────────────────────────
  page.on('dialog', (dialog) => dialog.accept());

  // Delete warranty (the trash icon is the second button in the card)
  const updatedWarrantyCard = page.locator('[class*="border-slate"]').filter({ hasText: 'Updated Motors Warranty' });
  await updatedWarrantyCard.getByRole('button').nth(1).click();
  await expect(page.getByText('Updated Motors Warranty')).not.toBeVisible();

  // Delete insurance
  const updatedInsuranceCard = page.locator('[class*="border-slate"]').filter({ hasText: 'Updated Insurance Corp' });
  await updatedInsuranceCard.getByRole('button').nth(1).click();
  await expect(page.getByText('Updated Insurance Corp')).not.toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

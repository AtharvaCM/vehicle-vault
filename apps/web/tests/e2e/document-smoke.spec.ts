import { expect, test } from '@playwright/test';

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
  await page.goto('/register');
  await page.getByLabel(/^name$/i).fill(name);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('link', { name: /add vehicle/i }).first().click();
  await page.getByLabel(/registration number/i).fill(registrationNumber);
  await page.getByLabel(/^make$/i).fill('Test Make');
  await page.getByLabel(/^model$/i).fill('Test Model');
  await page.getByLabel(/^variant$/i).fill('Test Variant');
  await page.getByLabel(/^year$/i).fill('2024');
  await page.getByLabel(/odometer/i).fill('1000');

  await page.getByLabel(/^vehicle type$/i).click();
  await page.getByRole('option', { name: 'SUV' }).click();

  await page.getByLabel(/^fuel type$/i).click();
  await page.getByRole('option', { name: 'Petrol' }).click();

  await page.getByRole('button', { name: /save vehicle/i }).click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);

  // ── 2. Go to Protection Tab ────────────────────────────────────────
  await page.getByRole('tab', { name: /protection/i }).click();

  // ── 3. Create Insurance ────────────────────────────────────────────
  await page.getByRole('button', { name: /add policy/i }).click();
  await expect(page.getByRole('heading', { name: /add insurance policy/i })).toBeVisible();
  await page.getByLabel(/provider name/i).fill('Test Insurance Corp');
  await page.getByLabel(/policy number/i).fill('INS12345');
  await page.getByLabel(/premium amount/i).fill('15000');
  await page.getByRole('button', { name: /add policy/i }).click();

  // Verify the insurance card appeared (list works)
  await expect(page.getByText('Test Insurance Corp')).toBeVisible();
  await expect(page.getByText('#INS12345')).toBeVisible();

  // ── 4. Create Warranty ─────────────────────────────────────────────
  await page.getByRole('button', { name: /add warranty/i }).click();
  await expect(page.getByRole('heading', { name: /add warranty coverage/i })).toBeVisible();
  await page.getByLabel(/provider\/brand/i).fill('Test Motors Warranty');
  await page.getByLabel(/warranty #/i).fill('WAR98765');
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

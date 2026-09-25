import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Regression coverage for the vehicle list's selection UI: selecting a
 * checkbox used to leave it visually unchecked (a wrapping label cancelled
 * the native toggle) and the bulk-delete confirmation never said which
 * vehicles it was about to remove.
 */
test('selecting a vehicle shows it as checked and names it in the delete confirmation', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const name = `E2E Selection ${suffix}`;
  const email = `e2e+selection${suffix}@vehiclevault.dev`;
  const password = 'VehicleVault!234';

  const nicknameToDelete = `Keep Away ${suffix.slice(-4)}`;
  const registrationToDelete = `MH12SL${suffix.slice(-4)}`;
  const nicknameToKeep = `Untouched ${suffix.slice(-4)}`;
  const registrationToKeep = `MH14SL${suffix.slice(-4)}`;

  await registerAndSignIn(page, { email, name, password });

  await createCatalogVehicle(page, {
    nickname: nicknameToDelete,
    odometer: '12000',
    registrationNumber: registrationToDelete,
  });

  await page.goto('/garage');
  await createCatalogVehicle(page, {
    nickname: nicknameToKeep,
    odometer: '8000',
    registrationNumber: registrationToKeep,
  });

  await page.goto('/garage');
  await expect(page.getByRole('heading', { level: 1, name: 'Garage' })).toBeVisible();
  // Bulk actions wait behind Select (#308).
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select', exact: true }).click();

  const checkboxToDelete = page.getByRole('checkbox', {
    name: new RegExp(`select vehicle ${nicknameToDelete}`, 'i'),
  });
  const checkboxToKeep = page.getByRole('checkbox', {
    name: new RegExp(`select vehicle ${nicknameToKeep}`, 'i'),
  });

  await checkboxToDelete.click();

  // The checkbox itself must render checked, not just update selection text.
  await expect(checkboxToDelete).toBeChecked();
  await expect(checkboxToKeep).not.toBeChecked();
  await expect(page.getByText('1 vehicle selected')).toBeVisible();

  // The selected row is marked, and tinted; the untouched one is not.
  const rowToDelete = page.getByTestId('garage-row').filter({ hasText: nicknameToDelete });
  const rowToKeep = page.getByTestId('garage-row').filter({ hasText: nicknameToKeep });
  await expect(rowToDelete).toHaveAttribute('data-selected', 'true');
  await expect(rowToDelete).toHaveClass(/bg-brand-tint/);
  await expect(rowToKeep).not.toHaveAttribute('data-selected', 'true');

  await page.getByRole('button', { name: 'Delete selected (1)' }).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(nicknameToDelete);
  await expect(dialog).toContainText(registrationToDelete);
  // The vehicle that was never selected must not be named as something the
  // confirmation is about to delete.
  await expect(dialog).not.toContainText(nicknameToKeep);

  // No need to go through with the delete — cancel and leave both vehicles.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

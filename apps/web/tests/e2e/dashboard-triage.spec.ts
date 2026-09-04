import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test('the triage dashboard surfaces a due reminder and clears it on Done', async ({ page }) => {
  const suffix = uniqueSuffix();
  const name = `E2E Triage ${suffix}`;
  const email = `e2etriage+${suffix}@vehiclevault.dev`;
  const password = 'VehicleVault!234';
  const registrationNumber = `MH12TR${suffix.slice(-4)}`;
  const nickname = `Triage Garage ${suffix.slice(-4)}`;
  const reminderTitle = `Brake check ${suffix.slice(-4)}`;

  await registerAndSignIn(page, { email, name, password });

  await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber,
  });

  await page
    .getByRole('link', { name: /^add reminder$/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/vehicles\/[^/]+\/reminders\/new$/);
  await page.getByLabel(/^title$/i).fill(reminderTitle);
  await page.getByLabel(/due date/i).fill('2026-09-06');
  await page.getByRole('button', { name: /save reminder/i }).click();
  await expect(page).toHaveURL(/\/reminders\/[^/]+$/);

  await page.goto('/dashboard');

  await expect(page.getByText('Needs attention')).toBeVisible();
  const row = page.getByTestId('attention-row').filter({ hasText: reminderTitle });
  await expect(row).toBeVisible();

  await expect(page.getByTestId('vehicle-health-card').filter({ hasText: nickname })).toBeVisible();

  await row.getByRole('button', { name: new RegExp(`mark ${reminderTitle} done`, 'i') }).click();

  await expect(row).not.toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

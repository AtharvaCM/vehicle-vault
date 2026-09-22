import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Midnight UTC, `days` from today: how the API stores a document's dates. */
function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

/**
 * Renewing re-uses everything the expiring record knows. Saving makes a new
 * record, the old one stays as history, and the attention the old one was
 * raising moves to the renewal, which is a year off.
 */
test('renewing a policy carries it over and takes its alert with it', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Renew ${suffix.slice(-4)}`;
  const provider = `Renewal Insurer ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Renew ${suffix}`,
    email: `e2e+renew${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12RN${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const old = await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicle.id,
      provider,
      policyNumber: `POL${suffix.slice(-6)}`,
      startDate: utcDay(-360),
      endDate: utcDay(5),
      premiumAmount: 14_500,
    },
  });

  // Five days out, the policy is on the dashboard's attention list.
  await page.goto('/dashboard');
  // One vehicle, so the row names the insurer rather than the vehicle.
  const attention = page.getByTestId('attention-row').filter({ hasText: provider });
  await expect(attention.filter({ hasText: 'Insurance policy' })).toBeVisible();

  // Renew from the card: the form arrives filled in.
  await page.goto(`${vehicleUrl}?tab=protection`);
  await page.getByRole('button', { name: 'Renew', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Renewing: details are copied/)).toBeVisible();
  await expect(dialog.getByLabel(/provider name/i)).toHaveValue(provider);
  await expect(dialog.getByLabel(/start date/i)).toHaveValue(utcDay(6).toISOString().slice(0, 10));
  await dialog.getByRole('button', { name: /^add policy$/i }).click();
  await expect(dialog).toBeHidden();

  // A new record beside the old one, which is kept as history.
  const policies = await prisma.insurancePolicy.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { startDate: 'asc' },
  });
  expect(policies).toHaveLength(2);
  expect(policies[0]?.id).toBe(old.id);
  expect(policies[1]).toMatchObject({ provider, policyNumber: old.policyNumber });
  // The superseded card no longer offers to renew itself.
  await expect(page.getByRole('button', { name: 'Renew', exact: true })).toHaveCount(0);

  // The renewal is a year off, so the dashboard has nothing to flag.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
  await expect(attention).toHaveCount(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const policyPdf = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample-receipt.pdf',
);

/**
 * A policy is a document, and now the app keeps the document too: the file is
 * uploaded on the policy's card, opened from there, removed from there, and
 * goes with the policy when the policy is deleted.
 */
test('a policy keeps its file, and loses it with the policy', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Files ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Files ${suffix}`,
    email: `e2e+files${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12DF${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const policy = await prisma.insurancePolicy.create({
    data: {
      vehicleId: vehicle.id,
      provider: `Files Insurer ${suffix.slice(-4)}`,
      policyNumber: `POL${suffix.slice(-6)}`,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
    },
  });

  await page.goto(`${vehicleUrl}?tab=protection`);
  const card = page.locator('div', { has: page.getByText(policy.provider!) }).filter({
    has: page.getByRole('region', { name: 'Document files' }),
  });
  const files = card.getByRole('region', { name: 'Document files' }).first();
  await expect(files.getByText('No files yet', { exact: false })).toBeVisible();

  // Upload onto the policy's card.
  await files.getByLabel('Add files to this document').setInputFiles(policyPdf);
  await expect(files.getByRole('button', { name: /^sample-receipt\.pdf/ })).toBeVisible();
  await expect
    .poll(() => prisma.attachment.count({ where: { insurancePolicyId: policy.id } }))
    .toBe(1);

  // Remove it from the card.
  await files.getByRole('button', { name: 'Remove sample-receipt.pdf' }).click();
  await expect(files.getByRole('button', { name: /^sample-receipt\.pdf/ })).toHaveCount(0);
  await expect
    .poll(() => prisma.attachment.count({ where: { insurancePolicyId: policy.id } }))
    .toBe(0);

  // Upload again, then delete the policy: its file goes with it.
  await files.getByLabel('Add files to this document').setInputFiles(policyPdf);
  await expect(files.getByRole('button', { name: /^sample-receipt\.pdf/ })).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: 'Delete document' }).first().click();
  await expect(page.getByText(policy.provider!)).toHaveCount(0);
  await expect
    .poll(() => prisma.attachment.count({ where: { insurancePolicyId: policy.id } }))
    .toBe(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

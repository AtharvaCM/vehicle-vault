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

test('a PUC certificate keeps its photo, and loses it with the record', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Puc ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Puc ${suffix}`,
    email: `e2e+pucfiles${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12PF${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const puc = await prisma.complianceDocument.create({
    data: {
      vehicleId: vehicle.id,
      kind: 'puc',
      provider: `PUC Centre ${suffix.slice(-4)}`,
      endDate: new Date('2027-03-01'),
    },
  });

  await page.goto(`${vehicleUrl}?tab=protection`);
  const card = page.locator('div', { has: page.getByText(puc.provider!) }).filter({
    has: page.getByRole('region', { name: 'Document files' }),
  });
  const files = card.getByRole('region', { name: 'Document files' }).first();
  await expect(files.getByText('Add a photo of the PUC certificate.')).toBeVisible();

  await files.getByLabel('Add files to this document').setInputFiles(policyPdf);
  await expect(files.getByRole('button', { name: /^sample-receipt\.pdf/ })).toBeVisible();
  await expect
    .poll(() => prisma.attachment.count({ where: { complianceDocumentId: puc.id } }))
    .toBe(1);

  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: 'Delete document' }).first().click();
  await expect(page.getByText(puc.provider!)).toHaveCount(0);
  await expect
    .poll(() => prisma.attachment.count({ where: { complianceDocumentId: puc.id } }))
    .toBe(0);
});

/**
 * A file belongs to exactly one thing. The database enforces it with a CHECK
 * constraint, which the migration adding compliance documents as owners had
 * to rebuild; this proves the rebuilt one still holds.
 */
test('the database still gives every file exactly one owner', async () => {
  const suffix = uniqueSuffix();
  const user = await prisma.user.create({
    data: {
      email: `e2e+owners${suffix}@vehiclevault.test`,
      name: 'Owner check',
      passwordHash: 'not-a-real-hash',
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      userId: user.id,
      registrationNumber: `MH12OW${suffix.slice(-4)}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      fuelType: 'petrol',
      odometer: 0,
      vehicleType: 'suv',
    },
  });
  const puc = await prisma.complianceDocument.create({
    data: { vehicleId: vehicle.id, kind: 'puc', endDate: new Date('2027-03-01') },
  });
  const policy = await prisma.insurancePolicy.create({
    data: { vehicleId: vehicle.id, endDate: new Date('2027-01-01') },
  });
  const file = {
    kind: 'document' as const,
    fileName: 'check/owner.pdf',
    originalFileName: 'owner.pdf',
    mimeType: 'application/pdf',
    size: 1,
    url: '/api/attachments/check/file',
  };

  try {
    // Two owners at once: refused.
    await expect(
      prisma.attachment.create({
        data: { ...file, complianceDocumentId: puc.id, insurancePolicyId: policy.id },
      }),
    ).rejects.toThrow(/attachment_owner_exclusive/);
    // No owner at all: refused.
    await expect(prisma.attachment.create({ data: file })).rejects.toThrow(
      /attachment_owner_exclusive/,
    );
    // The compliance document alone: accepted.
    await expect(
      prisma.attachment.create({ data: { ...file, complianceDocumentId: puc.id } }),
    ).resolves.toMatchObject({ complianceDocumentId: puc.id });
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

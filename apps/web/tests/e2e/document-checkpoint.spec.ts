import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

const PHONE = { width: 375, height: 812 };
const pucPdf = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample-receipt.pdf',
);

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

/**
 * The moment a document matters most is being asked to show it: a phone at
 * arm's length, in a hurry. Two taps from the vehicle, full screen, status
 * first, the number large, and the file itself.
 */
test('a document is two taps from the vehicle, full screen on a phone', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Check ${suffix.slice(-4)}`;
  const number = `PUC-${suffix.slice(-6)}`;

  await registerAndSignIn(page, {
    name: `E2E Checkpoint ${suffix}`,
    email: `e2e+checkpoint${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12CP${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  // Run out three days ago: the view has to say so, not just show dates.
  await prisma.complianceDocument.create({
    data: {
      vehicleId: vehicle.id,
      kind: 'puc',
      provider: `PUC Centre ${suffix.slice(-4)}`,
      number,
      startDate: utcDay(-183),
      endDate: utcDay(-3),
    },
  });

  // Attach the certificate on the card first, as an owner would.
  await page.goto(`${vehicleUrl}?tab=papers`);
  await page
    .getByRole('region', { name: 'Document files' })
    .first()
    .getByLabel('Add files to this document')
    .setInputFiles(pucPdf);
  await expect(page.getByRole('button', { name: /^sample-receipt\.pdf/ })).toBeVisible();

  // On a phone, from the vehicle: tap the Papers tab, then Show.
  await page.setViewportSize(PHONE);
  await page.goto(vehicleUrl);
  await page.getByRole('tab', { name: /^Papers/ }).click();
  await page.getByRole('link', { name: 'Show PUC Certificate full screen' }).click();

  const view = page.getByTestId('document-checkpoint');
  await expect(view).toBeVisible();
  // Covers the whole screen, the app's own navigation included.
  const box = await view.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: PHONE.width, height: PHONE.height });
  await expect(view.getByRole('status')).toContainText('EXPIRED');
  await expect(view.getByText(number)).toBeVisible();
  await expect(view.getByRole('button', { name: 'Open sample-receipt.pdf' })).toBeVisible();
  // Nothing on it spills off the side of the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    PHONE.width,
  );

  // And back to where it came from.
  await view.getByRole('link', { name: 'Back to the vehicle' }).click();
  await expect(page).toHaveURL(/tab=papers/);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

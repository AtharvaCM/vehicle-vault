import { rm } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

// A 1×1 PNG.
const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Uploads from before cloud storage was configured were lost with the
 * container that held them, but their rows remain. Opening one used to say only
 * "Could not open attachment"; it now says the file is gone and what to do.
 * Needs the local storage backend (ATTACHMENT_LOCAL_STORAGE_PATH), as CI runs.
 */
test('opening an attachment whose stored file is gone says so', async ({ page }) => {
  const storageRoot = process.env.ATTACHMENT_LOCAL_STORAGE_PATH;
  test.skip(!storageRoot, 'needs the local storage backend');

  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const nickname = `Lost ${suffix.slice(-4)}`;
  await registerAndSignIn(page, {
    name: `E2E Lost ${suffix}`,
    email: `e2e+lost${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '1000',
    registrationNumber: `MH12LF${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const token = await page.evaluate(
    () =>
      (
        JSON.parse(window.localStorage.getItem('vehicle-vault.auth-session') ?? '{}') as {
          accessToken?: string;
        }
      ).accessToken,
  );
  const headers = { Authorization: `Bearer ${token}` };

  const created = await page.request.post(`/api/vehicles/${vehicle.id}/maintenance-records`, {
    headers,
    data: {
      category: 'other',
      status: 'confirmed',
      serviceDate: new Date().toISOString(),
      odometer: 1100,
      totalCost: 100,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const record = ((await created.json()) as { data: { id: string } }).data;
  const uploaded = await page.request.post(`/api/maintenance-records/${record.id}/attachments`, {
    headers,
    multipart: { files: { name: 'job-card.png', mimeType: 'image/png', buffer: photo } },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const [attachment] = ((await uploaded.json()) as { data: Array<{ id: string }> }).data;

  // The row stays; the stored file goes.
  const row = await prisma.attachment.findUniqueOrThrow({ where: { id: attachment!.id } });
  await rm(path.join(storageRoot!, row.fileName), { force: true });

  await page.goto(`/maintenance-records/${record.id}`);
  await page.getByRole('button', { name: 'View file' }).click();

  await expect(
    page.getByText('This file is no longer in storage. Delete the attachment and upload it again.'),
  ).toBeVisible();
});

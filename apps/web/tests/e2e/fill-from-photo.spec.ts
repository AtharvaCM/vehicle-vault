import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function utcDay(days: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

// A 1×1 PNG: all the upload checks is that the bytes are what the name says.
const jobCardPhoto = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function authHeaders(page: Page) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  return { Authorization: `Bearer ${token}` };
}

/**
 * A service logged at the counter (#116) — date, odometer, cost and a photo of
 * the job card — is filled in later from that photo, on request. Only what the
 * record left blank is added; what was typed stays. It goes through the real
 * API, where the audit safety net fails any write not audited in its own
 * transaction.
 *
 * The e2e API has no AI key, so the read is stood in for: the extraction it
 * would have stored goes straight into the database, and the page is told the
 * extractor is configured, as it is wherever the key is set.
 */
test('a quick-logged service is filled in from its job card photo, keeping what was typed', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const nickname = `Fill ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Fill ${suffix}`,
    email: `e2e+fill${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12FP${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const headers = await authHeaders(page);

  // What the quick log saves, and the photo it attaches.
  const typedDate = utcDay(-1);
  const created = await page.request.post(`/api/vehicles/${vehicle.id}/maintenance-records`, {
    headers,
    data: {
      category: 'other',
      status: 'confirmed',
      serviceDate: typedDate.toISOString(),
      odometer: 15200,
      totalCost: 1500,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const record = ((await created.json()) as { data: { id: string } }).data;
  const uploaded = await page.request.post(`/api/maintenance-records/${record.id}/attachments`, {
    headers,
    multipart: { files: { name: 'job-card.png', mimeType: 'image/png', buffer: jobCardPhoto } },
  });
  expect(uploaded.ok(), await uploaded.text()).toBe(true);
  const [photo] = ((await uploaded.json()) as { data: Array<{ id: string }> }).data;

  // The job card as read: it disagrees with what was typed on the date, the
  // odometer and the total, and its line items come to the typed cost.
  await prisma.attachmentExtraction.create({
    data: {
      attachmentId: photo!.id,
      status: 'completed',
      provider: 'gemini',
      workshopName: 'Torque Garage',
      invoiceNumber: 'INV-77',
      serviceDate: utcDay(-3),
      odometer: 15180,
      totalCost: 1520,
      currencyCode: 'INR',
      notes: 'Oil and filter change',
      lineItems: [
        { kind: 'fluid', name: 'Engine oil', normalizedCategory: 'engine_oil', lineTotal: 1100 },
        { kind: 'labor', name: 'Labour', lineTotal: 400 },
      ],
      nextDueDate: utcDay(180),
      nextDueOdometer: 18200,
      extractedAt: new Date(),
    },
  });
  await page.route('**/api/attachments/extraction/status', (route) =>
    route.fulfill({ json: { success: true, data: { available: true } } }),
  );

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/maintenance-records/${record.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Other', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Fill in from photo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Fill in from the photo' });
  await expect(dialog.getByText('Torque Garage', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Engine Oil', { exact: true })).toBeVisible();
  await expect(dialog.getByText(/2 items, adding up to ₹1,500/)).toBeVisible();
  await expect(dialog.getByText('18,200 km', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fill in' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Engine Oil', exact: true }),
  ).toBeVisible();

  const filled = await prisma.maintenanceRecord.findUniqueOrThrow({
    where: { id: record.id },
    include: { lineItems: { orderBy: { position: 'asc' } } },
  });
  expect(filled).toMatchObject({
    category: 'engine_oil',
    workshopName: 'Torque Garage',
    invoiceNumber: 'INV-77',
    notes: 'Oil and filter change',
    nextDueOdometer: 18200,
    status: 'confirmed',
    source: 'manual',
    // As typed at the counter, not as read off the photo.
    odometer: 15200,
    serviceDate: typedDate,
  });
  expect(Number(filled.totalCost)).toBe(1500);
  expect(filled.lineItems.map((lineItem: { name: string }) => lineItem.name)).toEqual([
    'Engine oil',
    'Labour',
  ]);

  // One audited update, and the next-due it added is on the vehicle's reminders.
  const audits = await prisma.auditEvent.findMany({
    where: { resourceId: record.id, action: 'maintenance.updated' },
  });
  expect(audits).toHaveLength(1);
  const [audit] = audits;
  expect(audit?.changedFields).toEqual(
    expect.arrayContaining(['category', 'workshopName', 'lineItems', 'nextDueOdometer']),
  );
  expect(audit?.changedFields).not.toContain('totalCost');
  expect(audit?.changedFields).not.toContain('serviceDate');
  expect(await prisma.reminder.count({ where: { sourceMaintenanceRecordId: record.id } })).toBe(1);

  // A second look finds nothing left to add.
  await page.getByRole('button', { name: 'Fill in from photo' }).click();
  await expect(
    dialog.getByText('Nothing to add. This record already has everything the photo shows.'),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Fill in' })).toBeDisabled();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

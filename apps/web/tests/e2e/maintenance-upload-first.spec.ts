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

type ReadOutcome =
  | { status: 'completed'; fields: Record<string, unknown> }
  | { status: 'failed'; failureReason: string };

/**
 * The e2e API has no AI key, so the read is stood in for: the extract call is
 * answered here after storing what the extractor would have stored, and the
 * page is told the extractor is configured. Applying goes through the real API.
 */
async function standInForTheReader(page: Page, outcome: ReadOutcome) {
  await page.route('**/api/attachments/extraction/status', (route) =>
    route.fulfill({ json: { success: true, data: { available: true } } }),
  );
  await page.route('**/api/attachments/*/extract', async (route) => {
    const attachmentId = new URL(route.request().url()).pathname.split('/').at(-2)!;
    const data =
      outcome.status === 'completed'
        ? { status: 'completed', provider: 'gemini', extractedAt: new Date(), ...outcome.fields }
        : { status: 'failed', provider: 'gemini', failureReason: outcome.failureReason };
    const stored = await prisma.attachmentExtraction.create({ data: { attachmentId, ...data } });

    if (outcome.status === 'failed') {
      await route.fulfill({
        status: 500,
        json: { success: false, error: { message: outcome.failureReason } },
      });
      return;
    }

    await route.fulfill({
      json: {
        success: true,
        data: {
          ...outcome.fields,
          id: stored.id,
          attachmentId,
          status: 'completed',
          createdAt: stored.createdAt.toISOString(),
          updatedAt: stored.updatedAt.toISOString(),
        },
      },
    });
  });
}

async function setUp(page: Page, label: string) {
  const suffix = uniqueSuffix();
  const nickname = `${label} ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+upload${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12UF${suffix.slice(-4)}`,
  });

  return prisma.vehicle.findFirstOrThrow({ where: { nickname } });
}

async function uploadFirst(page: Page, vehicleId: string) {
  await page.goto(`/vehicles/${vehicleId}/maintenance/new`);
  await page.getByTestId('bill-file-input').setInputFiles({
    name: 'job-card.png',
    mimeType: 'image/png',
    buffer: jobCardPhoto,
  });
  await expect(page).toHaveURL(/\/maintenance-records\/[^/]+\/edit$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Confirm service record' }),
  ).toBeVisible();

  return page.url().split('/').at(-2)!;
}

test('upload-first opens the draft filled in from the bill, marked "from bill"', async ({
  page,
}) => {
  const vehicle = await setUp(page, 'Upload');
  const headers = await authHeaders(page);

  // A service already logged: upload-first must leave it exactly as it is.
  const logged = await page.request.post(`/api/vehicles/${vehicle.id}/maintenance-records`, {
    headers,
    data: {
      category: 'other',
      status: 'confirmed',
      serviceDate: utcDay(-30).toISOString(),
      odometer: 14000,
      totalCost: 900,
    },
  });
  expect(logged.ok(), await logged.text()).toBe(true);
  const confirmed = ((await logged.json()) as { data: { id: string } }).data;
  const before = await prisma.maintenanceRecord.findUniqueOrThrow({
    where: { id: confirmed.id },
  });

  await standInForTheReader(page, {
    status: 'completed',
    fields: {
      workshopName: 'Torque Garage',
      serviceDate: utcDay(-1),
      odometer: 15180,
      totalCost: 1520,
      currencyCode: 'INR',
    },
  });
  const draftId = await uploadFirst(page, vehicle.id);

  await expect(page.getByTestId('draft-bill-summary')).toContainText('Filled in from the bill');
  // The workshop's collapsed row names it and carries its marker.
  await expect(page.getByRole('button', { name: /^Workshop/ })).toContainText('Torque Garage');
  await expect(page.getByLabel('Odometer', { exact: true })).toHaveValue('15180');
  await expect(page.getByLabel('Total on the bill')).toHaveValue('1,520');
  // Date, odometer, total and workshop.
  await expect(page.getByText('from bill', { exact: true })).toHaveCount(4);

  // Editing a value takes its marker away.
  await page.getByLabel('Total on the bill').fill('1600');
  await expect(page.getByText('from bill', { exact: true })).toHaveCount(3);

  await page.getByRole('button', { name: 'Confirm Record' }).click();
  await expect(page).toHaveURL(new RegExp(`/maintenance-records/${draftId}$`));

  const saved = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: draftId } });
  expect(saved).toMatchObject({
    status: 'confirmed',
    workshopName: 'Torque Garage',
    odometer: 15180,
  });
  expect(Number(saved.totalCost)).toBe(1600);

  const after = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: confirmed.id } });
  expect(after).toEqual(before);
});

test('a bill that cannot be read opens the draft with a note, not silently blank', async ({
  page,
}) => {
  const vehicle = await setUp(page, 'Unread');

  await standInForTheReader(page, { status: 'failed', failureReason: 'The image is too blurry' });
  const draftId = await uploadFirst(page, vehicle.id);

  await expect(page.getByTestId('draft-bill-summary')).toContainText(
    'The bill could not be read (The image is too blurry)',
  );
  await expect(page.getByText('from bill', { exact: true })).toHaveCount(0);

  const draft = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: draftId } });
  expect(draft.status).toBe('draft');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

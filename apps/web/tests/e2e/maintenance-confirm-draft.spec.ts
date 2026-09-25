import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function api(page: Page, path: string, data?: unknown) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.fetch(`/api${path}`, {
    method: 'POST',
    data: data ?? {},
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * Confirming a scanned draft is one press of one button, and it stopped
 * working: the form emptied its own category as soon as it loaded the record,
 * so the press saved nothing and complained about a field that looked filled
 * in. This goes through the real API, with the real form.
 */
test('a scanned draft is confirmed from its edit page', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Confirm ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Confirm ${suffix}`,
    email: `e2e+confirm${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12CF${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  const draft = await api(page, `/vehicles/${vehicle.id}/maintenance-records/drafts`);

  await page.goto(`/maintenance-records/${draft.id}/edit`);

  // The draft's own category, not the placeholder the form used to fall back to.
  await expect(page.getByRole('button', { name: 'Other', pressed: true })).toBeVisible();
  await page.getByLabel('Total on the bill').fill('2400');
  await page.getByRole('button', { name: 'Confirm Record' }).click();

  await expect(page).toHaveURL(new RegExp(`/maintenance-records/${draft.id}$`));
  const saved = await prisma.maintenanceRecord.findUniqueOrThrow({ where: { id: draft.id } });
  expect(saved.status).toBe('confirmed');
  expect(Number(saved.totalCost)).toBe(2400);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

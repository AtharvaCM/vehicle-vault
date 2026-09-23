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

async function api(page: Page, method: 'POST' | 'PUT', path: string, data: unknown) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.fetch(`/api${path}`, {
    method,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * The bell already knew about worn tyres, service history nobody could answer,
 * and accessory warranties running out; the dashboard did not. Everything here
 * is set up through the real API and read back from the real queue, so the
 * rows come from the same rows the alert engine reads.
 */
test('the dashboard lists what the bell knows about tyres, history and accessories', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const nickname = `Bell ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Bell ${suffix}`,
    email: `e2e+bell${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12BL${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  // A front tyre measured below the legal minimum.
  const tyre = await api(page, 'POST', `/vehicles/${vehicle.id}/tyres`, {
    position: 'front_left',
    fittedDate: utcDay(-200).toISOString(),
    fittedOdometer: 5000,
  });
  await api(page, 'POST', `/vehicles/${vehicle.id}/tyre-inspections`, {
    tyreId: tyre.id,
    inspectedAt: utcDay(-1).toISOString(),
    odometer: 14900,
    treadDepthMm: 1.4,
  });

  // Two parts of the history the owner said they do not know.
  await api(page, 'PUT', `/vehicles/${vehicle.id}/service-baseline`, {
    entries: [
      { category: 'brake_pads', status: 'unknown' },
      { category: 'coolant', status: 'unknown' },
    ],
  });

  // A fitted dashcam whose warranty runs out in five days.
  await api(page, 'POST', `/vehicles/${vehicle.id}/accessories`, {
    name: 'Dashcam',
    brand: '70mai',
    purchaseDate: utcDay(-300).toISOString(),
    cost: 6000,
    fittedDate: utcDay(-300).toISOString(),
    warrantyExpiresAt: utcDay(5).toISOString(),
  });

  await page.goto('/dashboard');

  const queue = page.getByTestId('attention-row');
  await expect(queue.filter({ hasText: 'Tyre not roadworthy' })).toContainText(
    'Front left · 1.4 mm tread',
  );
  await expect(queue.filter({ hasText: '70mai Dashcam warranty' })).toContainText('5 days left');

  const comingUp = page.getByRole('region', { name: 'Coming up' });
  await expect(comingUp.getByRole('link', { name: /Unknown service history/ })).toContainText(
    'Brake pads and coolant',
  );

  // Added today, so the cold-start questions wait, in the queue as in the bell.
  await expect(page.getByText('Tyres not tracked')).toHaveCount(0);
  await expect(page.getByText('Add this vehicle’s service history')).toHaveCount(0);

  // Each row leads to the tab that fixes it.
  await page.getByRole('link', { name: 'View tyres' }).click();
  await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicle.id}\\?tab=tyres`));
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

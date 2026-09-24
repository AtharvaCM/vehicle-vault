import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function api(page: Page, method: 'GET' | 'PUT', path: string, data?: unknown) {
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
  return ((await response.json()) as { data: unknown }).data;
}

/**
 * The health card scores how much a vehicle knows about itself and names the
 * one gap most worth filling. Filling it, through the real API, raises the
 * score on the next load and moves the card on to the next gap.
 */
test('the health card scores a vehicle’s data and moves on once a gap is filled', async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const nickname = `Score ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Score ${suffix}`,
    email: `e2e+score${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12SC${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  // Linked to the catalog and freshly read, but no history, papers, tyres or price.
  await page.goto('/home');
  const card = page.getByTestId('vehicle-health-card').filter({ hasText: nickname });
  await expect(card).toContainText('35% · Service history incomplete');
  await expect(card.getByRole('link', { name: 'Service history incomplete' })).toHaveAttribute(
    'href',
    `/vehicles/${vehicle.id}?tab=history`,
  );

  // Answer every category, even if only with "unknown": an answer is an answer.
  const coverage = (await api(page, 'GET', `/vehicles/${vehicle.id}/service-baseline`)) as {
    entries: { category: string }[];
  };
  await api(page, 'PUT', `/vehicles/${vehicle.id}/service-baseline`, {
    entries: coverage.entries.map((entry) => ({ category: entry.category, status: 'unknown' })),
  });

  await page.reload();
  await expect(card).toContainText('60% · No current insurance');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

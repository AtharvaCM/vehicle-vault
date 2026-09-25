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

async function api(page: Page, path: string, data: unknown) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.fetch(`/api${path}`, {
    method: 'POST',
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

/**
 * A DOT code typed wrong could not be corrected, a tyre fitted by mistake could
 * not be removed, and past readings could not be seen. This goes through the
 * real API, so the grading after the edit is the resolver's own.
 */
test('a tyre can be reviewed, corrected and deleted from the tracker', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Tyres ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Tyres ${suffix}`,
    email: `e2e+tyres${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12TY${suffix.slice(-4)}`,
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

  const tyre = await api(page, `/vehicles/${vehicle.id}/tyres`, {
    position: 'front_left',
    brand: 'Michelin',
    dotWeek: 36,
    dotYear: 2024,
    fittedDate: utcDay(-200).toISOString(),
    fittedOdometer: 5000,
  });
  await api(page, `/vehicles/${vehicle.id}/tyre-inspections`, {
    tyreId: tyre.id,
    inspectedAt: utcDay(-100).toISOString(),
    odometer: 10000,
    treadDepthMm: 6,
    pressurePsi: 32,
  });
  await api(page, `/vehicles/${vehicle.id}/tyre-inspections`, {
    tyreId: tyre.id,
    inspectedAt: utcDay(-1).toISOString(),
    odometer: 14900,
    treadDepthMm: 5.2,
  });

  await page.goto(`/vehicles/${vehicle.id}?tab=more&section=tyres`);
  const card = page.getByTestId('tyre-corner').filter({ hasText: 'Front left' });
  await expect(card).toContainText('Good');
  await expect(card).toContainText('5.2 mm');

  // The history, newest first, as recorded: each reading, then the fitting.
  const history = page.getByTestId('tyre-history-item');
  await expect(history.nth(0)).toContainText('Inspection · front left 5.2 mm');
  await expect(history.nth(1)).toContainText('Inspection · front left 6 mm · 32 psi');
  await expect(history.nth(2)).toContainText('Fitted front left');

  // A DOT code typed wrong: the tyre is really from 2018, and age retires it.
  await card.getByRole('button', { name: 'Edit the front left tyre' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('DOT code')).toHaveValue('3624');
  await dialog.getByLabel('DOT code').fill('0118');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  // The grading shown now is the resolver's, fetched again, not worked out in the page.
  await expect(card).toContainText('Replace soon');
  await expect(page.getByTestId('tyre-verdict')).toContainText(
    /Front left tyre: \d+ years old — replace soon/,
  );

  // Fitted by mistake: gone, and its readings with it.
  await card.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('Its 2 readings will be deleted with it.');
  await confirm.getByRole('button', { name: 'Delete tyre' }).click();
  await expect(page.getByTestId('tyres-empty')).toContainText('Add your tyres');
  expect(await prisma.tyre.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  expect(await prisma.tyreInspection.count({ where: { vehicleId: vehicle.id } })).toBe(0);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

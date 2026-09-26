import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const PASSWORD = 'VehicleVault!234';

async function post(page: Page, path: string, data: object) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api/${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `POST ${path}: ${await response.text()}`).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

async function signUpWithVehicle(page: Page, label: string) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `e2e+${label}${suffix}@vehiclevault.dev`;
  await registerAndSignIn(page, { name: `E2E Delete ${suffix}`, email, password: PASSWORD });
  const vehicle = await post(page, 'vehicles', {
    registrationNumber: `MH12DA${suffix.slice(-4)}`,
    make: 'Hyundai',
    model: 'Creta',
    year: 2023,
    vehicleType: 'suv',
    fuelType: 'petrol',
    odometer: 18000,
    nickname: `Family ${suffix.slice(-4)}`,
  });
  return { email, suffix, vehicleId: vehicle.id };
}

async function openDeleteDialog(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Delete account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * #317: an owner deletes their own account from Settings, at once, after
 * their password, with the backup offered first; afterwards sign-in fails and
 * the data is gone. A vehicle shared with someone else blocks it.
 */
for (const viewport of VIEWPORTS) {
  test(`an owner deletes their account from Settings, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { email, vehicleId } = await signUpWithVehicle(page, 'deleteme');

    const dialog = await openDeleteDialog(page);
    await expect(dialog.getByTestId('delete-account-what-goes')).toContainText('1 vehicle');
    await expect(dialog.getByRole('button', { name: 'Download your data first' })).toBeVisible();
    await dialog.getByLabel('Password', { exact: true }).fill(PASSWORD);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/delete-account-confirm-${viewport.width}.png`,
        animations: 'disabled',
      });
    await dialog.getByRole('button', { name: 'Delete my account' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Account deleted')).toBeVisible();

    // Gone: sign-in fails and nothing of it is left.
    const login = await page.request.post('/api/auth/login', {
      data: { email, password: PASSWORD },
    });
    expect(login.status()).toBe(401);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.vehicle.count({ where: { id: vehicleId } })).toBe(0);
  });
}

test('a vehicle shared with someone else blocks deletion until it is handed over', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { email, suffix, vehicleId } = await signUpWithVehicle(page, 'sharer');
  const member = await prisma.user.create({
    data: {
      name: `E2E Member ${suffix}`,
      email: `e2e+member${suffix}@vehiclevault.dev`,
      emailVerified: true,
    },
  });
  await prisma.vehicleMember.create({ data: { vehicleId, userId: member.id, role: 'viewer' } });

  const dialog = await openDeleteDialog(page);
  const shared = dialog.getByTestId('delete-account-shared');
  await expect(shared).toContainText('shared with 1 person');
  await expect(shared.getByRole('link', { name: 'Members' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Delete my account' })).toHaveCount(0);
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/delete-account-blocked-1440.png`,
      animations: 'disabled',
    });

  // The API refuses too, whatever the page offers.
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const refused = await page.request.delete('/api/auth/me', {
    data: { password: PASSWORD },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(refused.status()).toBe(409);
  expect(await prisma.user.count({ where: { email } })).toBe(1);

  await prisma.user.delete({ where: { id: member.id } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots of each state (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function api(page: Page, path: string, body: Record<string, unknown>) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api${path}`, {
    data: body,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, animations: 'disabled' });
}

async function setUp(page: Page, label: string) {
  const suffix = uniqueSuffix();
  const nickname = `${label} ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+overview${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const vehicleUrl = await createCatalogVehicle(page, {
    nickname,
    odometer: '15200',
    registrationNumber: `MH12OV${suffix.slice(-4)}`,
  });

  return { nickname, vehicleUrl, vehicleId: new URL(vehicleUrl).pathname.split('/').pop()! };
}

for (const viewport of VIEWPORTS) {
  test.describe(`Overview at ${viewport.width}px`, () => {
    test('answers "is it OK, and what\'s next" for a vehicle in use', async ({ page }) => {
      const { vehicleUrl, vehicleId } = await setUp(page, 'Busy');
      await api(page, `/vehicles/${vehicleId}/maintenance-records`, {
        category: 'engine_oil',
        serviceDate: daysFromNow(-30),
        odometer: 15_000,
        workshopName: 'City Service',
        totalCost: 4_200,
      });
      await api(page, `/vehicles/${vehicleId}/reminders`, {
        title: 'Wheel alignment',
        type: 'service',
        dueDate: daysFromNow(2),
      });
      await page.setViewportSize(viewport);
      await page.goto(vehicleUrl);

      // Needs attention: this vehicle's due item, with its verb.
      const queue = page.locator('[data-slot="card"]', {
        has: page.getByRole('heading', { name: 'Needs attention' }),
      });
      await expect(queue.getByText('Wheel alignment')).toBeVisible();
      await expect(queue.getByRole('link', { name: 'All reminders' })).toBeVisible();

      // This vehicle: the reading, updatable in place.
      const card = page.getByTestId('this-vehicle');
      await expect(card).toContainText('15,200 km');
      await expect(card).toContainText('Last service');
      await card.getByRole('button', { name: /update odometer/i }).click();
      await page.getByLabel('New reading (km)').fill('15600');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(card).toContainText('15,600 km');

      // Running cost and Recent activity.
      const cost = page.getByTestId('running-cost');
      // No purchase odometer yet, so no rate: the total leads.
      await expect(cost).toContainText('Spent since you added it');
      await expect(cost).toContainText('₹4,200');
      await expect(page.getByTestId('recent-activity')).toContainText('City Service');

      // Nothing on the page runs wider than the screen.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await shot(page, `overview-busy-${viewport.width}`);
    });

    test('starts a new vehicle on its setup checklist', async ({ page }) => {
      const { vehicleUrl } = await setUp(page, 'Fresh');
      await page.setViewportSize(viewport);
      await page.goto(vehicleUrl);

      await expect(page.getByText('All clear')).toBeVisible();
      const checklist = page.getByTestId('setup-checklist');
      await expect(checklist.getByRole('link', { name: 'Log the last service' })).toBeVisible();
      await expect(page.getByTestId('running-cost')).toHaveCount(0);
      await expect(page.getByTestId('recent-activity')).toHaveCount(0);
      await shot(page, `overview-new-${viewport.width}`);

      await checklist.getByRole('link', { name: 'Log the last service' }).click();
      await expect(page).toHaveURL(/\/maintenance\/new$/);
    });
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

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

async function api(page: Page, path: string, data: Record<string, unknown>) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true, animations: 'disabled' });
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function garage(page: Page, label: string, count: number) {
  const suffix = uniqueSuffix();
  await registerAndSignIn(page, {
    name: `E2E ${label} ${suffix}`,
    email: `e2e+home${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    // A full load between vehicles: the form's catalog lists come from the cache otherwise.
    if (index > 0) await page.goto('/garage');
    const url = await createCatalogVehicle(page, {
      nickname: `${label} ${index + 1} ${suffix.slice(-4)}`,
      odometer: '15200',
      registrationNumber: `MH12H${String.fromCharCode(65 + index)}${suffix.slice(-4)}`,
    });
    ids.push(new URL(url).pathname.split('/').pop()!);
  }
  return ids;
}

for (const viewport of VIEWPORTS) {
  test.describe(`Home at ${viewport.width}px`, () => {
    test('a busy garage: one status line, the queue, and a compact strip', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const [first, second] = await garage(page, 'Busy', 2);
      await api(page, `/vehicles/${first}/reminders`, {
        title: 'Brake pads',
        type: 'service',
        dueDate: daysFromNow(-3),
      });
      await api(page, `/vehicles/${second}/reminders`, {
        title: 'Wheel alignment',
        type: 'service',
        dueDate: daysFromNow(2),
      });
      await page.setViewportSize(viewport);
      await page.goto('/home');

      await expect(page.getByText('1 late · 1 this week · across 2 vehicles')).toBeVisible();
      const filters = page.getByRole('navigation', { name: 'Filter what needs attention' });
      await filters.getByRole('link', { name: /Late/ }).click();
      await expect(page).toHaveURL(/focus=overdue/);
      await expect(page.getByTestId('attention-row')).toHaveCount(1);
      await filters.getByRole('link', { name: /All/ }).click();
      await expect(page.getByTestId('attention-row')).toHaveCount(2);

      await expect(page.getByTestId('garage-chip')).toHaveCount(2);
      await expect(page.getByTestId('vehicle-health-card')).toHaveCount(0);
      await expectNoSidewaysScroll(page);
      await shot(page, `home-busy-${viewport.width}`);
    });

    test('an all-clear garage says so, and what comes next', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const [first] = await garage(page, 'Clear', 2);
      await api(page, `/vehicles/${first}/reminders`, {
        title: 'Timing belt check',
        type: 'service',
        dueDate: daysFromNow(20),
      });
      await page.setViewportSize(viewport);
      await page.goto('/home');

      const panel = page.getByTestId('all-clear');
      await expect(panel).toContainText('All clear.');
      await expect(panel).toContainText('Next: Timing belt check');
      await expect(page.getByRole('heading', { name: 'Needs attention' })).toHaveCount(0);
      await expectNoSidewaysScroll(page);
      await shot(page, `home-clear-${viewport.width}`);
    });

    test('a one-vehicle garage gets its summary row, and one Log menu', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await garage(page, 'Solo', 1);
      await page.setViewportSize(viewport);
      await page.goto('/home');

      const row = page.getByTestId('vehicle-summary-row');
      await expect(row).toContainText('15,200 km');
      await expect(page.getByTestId('garage-strip')).toHaveCount(0);

      // One Log menu: in the header from md up, the bottom bar's ＋ below it.
      await page
        .getByTestId(viewport.width >= 768 ? 'home-log-button' : 'quick-log-button')
        .click();
      const menu = page.getByRole('dialog', { name: 'Log' });
      await expect(menu.getByRole('button', { name: 'Update odometer' })).toBeVisible();
      await shot(page, `home-solo-menu-${viewport.width}`);
      await menu.getByRole('button', { name: 'Update odometer' }).click();
      await page.getByLabel('New reading (km)').fill('15500');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(row).toContainText('15,500 km');
      await expectNoSidewaysScroll(page);
    });
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

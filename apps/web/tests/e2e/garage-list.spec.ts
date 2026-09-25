import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
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

for (const viewport of VIEWPORTS) {
  test(`the garage is a status list, most urgent first, at ${viewport.width}px`, async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const short = suffix.slice(-4);
    await registerAndSignIn(page, {
      name: `E2E Garage ${suffix}`,
      email: `e2e+garagelist${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    // Added first, so a list by date or name alone would put it on top.
    await createCatalogVehicle(page, {
      nickname: `Alpha ${short}`,
      odometer: '15200',
      registrationNumber: `MH12GA${short}`,
    });
    await page.goto('/garage');
    const lateUrl = await createCatalogVehicle(page, {
      nickname: `Zulu ${short}`,
      odometer: '32000',
      registrationNumber: `MH12GZ${short}`,
    });
    await api(page, `/vehicles/${new URL(lateUrl).pathname.split('/').pop()}/reminders`, {
      title: 'Insurance renewal',
      type: 'service',
      dueDate: daysFromNow(-3),
    });

    await page.setViewportSize(viewport);
    await page.goto('/garage');

    const rows = page.getByTestId('garage-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText(`Zulu ${short}`);
    await expect(rows.nth(0)).toContainText('1 late');
    await expect(rows.nth(0)).toContainText('Insurance renewal');
    await expect(rows.nth(1)).toContainText(`Alpha ${short}`);
    await expect(rows.nth(1)).toContainText('All clear');
    await expect(page.getByRole('searchbox', { name: 'Search vehicles' })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/garage-${viewport.width}.png`,
        animations: 'disabled',
      });
    }

    // Select mode: checkboxes and the bulk bar, and Done puts them away.
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('checkbox', { name: `Select vehicle Alpha ${short}` }).click();
    await expect(page.getByText('1 vehicle selected')).toBeVisible();
    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/garage-select-${viewport.width}.png`,
        animations: 'disabled',
      });
    }
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    // A row opens its vehicle.
    await rows
      .nth(1)
      .getByRole('link', { name: new RegExp(`Alpha ${short}`) })
      .first()
      .click();
    await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

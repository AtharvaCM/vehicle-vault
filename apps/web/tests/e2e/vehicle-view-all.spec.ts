import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** Seeds through the API as the signed-in user: far quicker than the forms. */
async function api(page: Page, path: string, data: unknown) {
  const token = await page.evaluate(() => {
    const raw = window.localStorage.getItem('vehicle-vault.auth-session');
    return raw ? (JSON.parse(raw) as { accessToken?: string }).accessToken : '';
  });
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { id: string } }).data;
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
] as const;

/**
 * The vehicle page's Overview tab no longer links to a per-vehicle list page
 * (#278): "View all" under Recent activity and "All reminders" under Needs
 * attention open the History and Reminders tabs instead.
 */
for (const viewport of viewports) {
  test(`Overview's "View all" links open the History and Reminders tabs, on ${viewport.name}`, async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const nickname = `ViewAll ${viewport.name} ${suffix.slice(-4)}`;
    const workshopName = `Vista Motors ${suffix.slice(-4)}`;
    const reminderTitle = `PUC renewal ${suffix.slice(-4)}`;

    await registerAndSignIn(page, {
      name: `E2E ViewAll ${suffix}`,
      email: `e2e+viewall${viewport.name}${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '15200',
      registrationNumber: `MH12VA${suffix.slice(-4)}`,
    });
    const vehicleId = new URL(vehicleUrl).pathname.split('/').pop()!;

    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await api(page, `/vehicles/${vehicleId}/maintenance-records`, {
      category: 'periodic_service',
      serviceDate: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      odometer: 15250,
      workshopName,
      totalCost: 2_500,
    });
    await api(page, `/vehicles/${vehicleId}/reminders`, {
      title: reminderTitle,
      type: 'puc',
      dueDate: new Date(Date.now() + 20 * 86_400_000).toISOString(),
    });

    await page.goto('/home');
    await expect(page.getByRole('heading', { level: 1, name: /^(Home|Welcome)/ })).toBeVisible();

    const summaryRow = page.getByTestId('vehicle-summary-row').filter({ hasText: nickname });
    await summaryRow.getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}$`));

    const strip = page.getByRole('tablist', { name: 'Vehicle sections' });

    await page.getByTestId('recent-activity').getByRole('link', { name: 'View all' }).click();

    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}\\?tab=history$`));
    await expect(strip.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByRole('tabpanel').getByRole('link', { name: new RegExp(workshopName) }),
    ).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}$`));

    await page
      .locator('[data-slot="section-header"]', { hasText: 'Needs attention' })
      .getByRole('link', { name: 'All reminders' })
      .click();

    await expect(page).toHaveURL(new RegExp(`/vehicles/${vehicleId}\\?tab=reminders$`));
    await expect(strip.getByRole('tab', { name: 'Reminders' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      page.getByRole('tabpanel').getByRole('link', { name: new RegExp(reminderTitle) }),
    ).toBeVisible();
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

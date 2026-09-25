import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/** Seeds through the API as the signed-in user: far quicker than the forms. */
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

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/**
 * #336: accessories live in History. Added from the vehicle's Log menu with a
 * receipt, listed on the vehicle's History tab and the garage's History page,
 * opened from the row to edit or delete, and the old section's links follow.
 */
for (const viewport of VIEWPORTS) {
  test(`accessories live in History, with a receipt, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nickname = `Kit ${suffix.slice(-4)}`;
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E Accessories ${suffix}`,
      email: `e2e+accessories${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicle = await post(page, 'vehicles', {
      registrationNumber: `MH12KT${suffix.slice(-4)}`,
      make: 'Hyundai',
      model: 'Creta',
      year: 2024,
      vehicleType: 'suv',
      fuelType: 'petrol',
      odometer: 18000,
      nickname,
    });

    // Added with its receipt: from Quick log on a phone, the header's Log menu on a desktop.
    await page.goto(`/vehicles/${vehicle.id}`);
    if (viewport.width < 768) {
      await page.getByRole('button', { name: 'Log', exact: true }).first().click();
      await page.getByRole('button', { name: 'Add accessory' }).click();
    } else {
      await page.getByRole('button', { name: 'Log', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Accessory' }).click();
    }
    const dialog = page.getByRole('dialog', { name: 'Add an accessory' });
    await dialog.getByLabel('Name').fill('Dashcam');
    await dialog.getByLabel('Brand').fill('Croma');
    await dialog.getByLabel('Cost').fill('6499');
    await dialog.getByLabel('Warranty expires').fill('2027-03-12');
    await dialog.getByLabel('Receipt').setInputFiles({
      name: 'dashcam-receipt.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 receipt'),
    });
    await dialog.getByRole('button', { name: 'Add accessory' }).click();
    await expect(dialog).toBeHidden();

    // The vehicle's History tab lists it under Accessories.
    await page.goto(`/vehicles/${vehicle.id}?tab=history&view=accessory`);
    const row = page
      .getByTestId('vehicle-accessory-history')
      .getByTestId('history-row')
      .filter({ hasText: 'Dashcam' });
    await expect(row).toContainText('Croma');
    await expect(row).toContainText('warranty to 12 Mar 2027');
    await expect(row).toContainText('₹6,499');
    await expect(row.getByRole('button', { name: 'Open the receipt for Dashcam' })).toBeVisible();
    await expectNoSidewaysScroll(page, 'the vehicle accessory log');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/accessories-vehicle-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // The garage's History page has an Accessory kind, and finds it by name.
    await page.goto('/history?kind=accessory&search=dash');
    await expect(page.getByTestId('history-row').filter({ hasText: 'Dashcam' })).toBeVisible();
    await expectNoSidewaysScroll(page, 'the History page');
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/accessories-history-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // The row opens it: edit the cost, then delete it.
    await page.goto(`/vehicles/${vehicle.id}?tab=history&view=accessory`);
    await page.getByRole('button', { name: 'Edit Dashcam' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit accessory' });
    await edit.getByLabel('Cost').fill('5999');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit).toBeHidden();
    await expect(row).toContainText('₹5,999');
    await page.getByRole('button', { name: 'Edit Dashcam' }).click();
    await page
      .getByRole('dialog', { name: 'Edit accessory' })
      .getByRole('button', { name: 'Delete' })
      .click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('No accessories yet')).toBeVisible();
    expect(await prisma.attachment.count({ where: { accessory: { vehicleId: vehicle.id } } })).toBe(
      0,
    );

    // The old More → Accessories link lands on the accessory log.
    await page.goto(`/vehicles/${vehicle.id}?tab=more&section=accessories`);
    await expect(page).toHaveURL(/view=accessory/);
    await expect(page.getByTestId('vehicle-accessory-history')).toBeVisible();
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

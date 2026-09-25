import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { selectDropdownOption, selectSearchableOption } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

/**
 * The redesigned add-vehicle flow (#297): the plate first, formatted and
 * validated as it is typed; a vehicle with no year or odometer preselected;
 * then a short papers step before landing on the vehicle. Phone and desktop
 * both drive it end to end, one skipping the papers step and the other
 * answering it, so both of the step's exits are covered.
 */
for (const viewport of viewports) {
  test(`add a vehicle on a ${viewport.name} from plate to papers`, async ({ page }) => {
    test.slow();
    const suffix = uniqueSuffix();
    const nickname = `Plate ${viewport.name} ${suffix.slice(-4)}`;

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await registerAndSignIn(page, {
      name: `E2E Plate ${viewport.name} ${suffix}`,
      email: `e2e+plate${viewport.name}${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });

    await page
      .getByRole('link', { name: /add vehicle/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/vehicles\/new$/);

    // Neither is preselected: a fresh form has no year and no odometer.
    await expect(page.getByLabel(/^year$/i)).toHaveValue('');
    await expect(page.getByLabel('Odometer', { exact: true })).toHaveValue('');

    // Something that will never become a recognised plate is rejected on blur,
    // before the vehicle is even a candidate for saving.
    const plateField = page.getByLabel(/registration number/i);
    await plateField.fill('not a plate');
    await plateField.blur();
    await expect(page.getByText(/valid Indian registration number/i)).toBeVisible();

    // Typed lower-case and unspaced, it formats itself as the plate prints it.
    const registrationNumber = `MH12PL${suffix.slice(-4)}`;
    await plateField.fill('');
    await plateField.pressSequentially(registrationNumber.toLowerCase());
    await expect(plateField).toHaveValue(
      `${registrationNumber.slice(0, 2)} ${registrationNumber.slice(2, 4)} ${registrationNumber.slice(4, 6)} ${registrationNumber.slice(6)}`,
    );
    await expect(page.getByText(/valid Indian registration number/i)).toHaveCount(0);

    await selectDropdownOption(page, /^vehicle type$/i, 'SUV');

    const makeOptions = page.waitForResponse(
      (response) =>
        response.url().includes('/api/vehicle-catalog/makes') &&
        response.url().includes('year=2024') &&
        response.ok(),
    );
    await page.getByLabel(/^year$/i).fill('2024');
    await page.getByLabel(/^year$/i).press('Tab');
    await makeOptions;

    const modelOptions = page.waitForResponse(
      (response) => response.url().includes('/api/vehicle-catalog/models') && response.ok(),
    );
    await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
    await modelOptions;
    await selectSearchableOption(page, 'vehicle-model', 'Search models...', 'Creta', 'Creta');

    await page.getByLabel('Odometer', { exact: true }).fill('12500');
    await page.getByLabel(/nickname/i).fill(nickname);
    await page.getByRole('button', { name: /save vehicle/i }).click();

    // The papers step, still on /vehicles/new: saving does not go straight to
    // the vehicle.
    await expect(page).toHaveURL(/\/vehicles\/new$/);
    await expect(page.getByText('Never miss a renewal')).toBeVisible();

    if (viewport.name === 'phone') {
      await page.getByRole('button', { name: 'Skip for now' }).click();
    } else {
      await page.getByLabel('Insurance expires on').fill('2027-04-01');
      await page.getByLabel('PUC expires on').fill('2026-12-20');
      await page.getByRole('button', { name: 'Save dates' }).click();
    }

    await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
    await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

    const saved = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
    // Stored compact, however the plate input grouped it.
    expect(saved.registrationNumber).toBe(registrationNumber);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

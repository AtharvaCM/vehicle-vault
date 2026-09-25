import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/**
 * #320: Tyres starts with one card and a three-step setup, then reads as a
 * verdict, a wheel diagram with each wheel's tread and age, and one history.
 */
for (const viewport of VIEWPORTS) {
  test(`tyres are set up in three steps, then read as a verdict, a diagram and a history, at ${viewport.width}px`, async ({
    page,
  }) => {
    test.slow();
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nickname = `Tyres ${suffix.slice(-4)}`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await registerAndSignIn(page, {
      name: `E2E Tyres ${suffix}`,
      email: `e2e+tyres${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    // The catalogue form needs a wide viewport; narrow afterwards.
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '24000',
      registrationNumber: `MH12TY${suffix.slice(-4)}`,
    });
    await page.setViewportSize(viewport);

    // Empty: one card, no diagram of unmeasured wheels.
    await page.goto(`${vehicleUrl}?tab=more&section=tyres`);
    const empty = page.getByTestId('tyres-empty');
    await expect(empty).toContainText('Add your tyres');
    await expect(page.getByTestId('wheel-diagram')).toHaveCount(0);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/tyres-empty-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Three steps: size and brand for all, the DOT date, tread per wheel.
    await empty.getByRole('button', { name: 'Add tyres' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add your tyres' });
    await dialog.getByLabel('Size').fill('215/60 R16');
    await dialog.getByLabel('Brand').fill('MRF');
    await dialog.getByLabel('Model').fill('ZLX');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByLabel('DOT date').fill('3624');
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByLabel('Front left').fill('6.1');
    await dialog.getByLabel('Front right').fill('6');
    await dialog.getByLabel('Rear left').fill('2.4');
    // Rear right left blank: its tread is simply not known yet.
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/tyres-setup-${viewport.width}.png`,
        animations: 'disabled',
      });
    await dialog.getByRole('button', { name: 'Save tyres' }).click();
    await expect(dialog).toBeHidden();

    // The verdict leads with the worst tyre, as the API grades it.
    await expect(page.getByTestId('tyre-verdict')).toHaveText(
      'Rear left tyre: 2.4 mm — replace soon',
    );
    const corners = page.getByTestId('tyre-corner');
    await expect(corners).toHaveCount(4);
    await expect(corners.filter({ hasText: 'Front left' })).toContainText('6.1 mm · 2 yrs');
    await expect(corners.filter({ hasText: 'Rear left' })).toContainText('Replace soon');
    await expect(corners.filter({ hasText: 'Rear right' })).toContainText('Tread not measured');
    await expect(corners.first()).toContainText('MRF ZLX · 215/60 R16 · DOT 3624');

    // One history: the walk-around on one line, and each tyre fitted.
    const history = page.getByTestId('tyre-history-item');
    await expect(history.first()).toContainText(
      'Inspection · front left 6.1 mm, front right 6 mm, rear left 2.4 mm',
    );
    // The set fitted together is one entry.
    await expect(history.filter({ hasText: 'Fitted' })).toHaveText([/Fitted 4 tyres · MRF ZLX/]);

    await expect(page.getByText('Tyres added')).toBeHidden({ timeout: 15_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/tyres-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    const vehicleId = vehicleUrl.split('/').pop()!;
    expect(await prisma.tyre.count({ where: { vehicleId } })).toBe(4);
    expect(await prisma.tyreInspection.count({ where: { vehicleId } })).toBe(3);
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

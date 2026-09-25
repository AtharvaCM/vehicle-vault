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

/** Specs this run added to the shared catalog, removed again at the end. */
const createdSpecIds: string[] = [];

async function expectNoSidewaysScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const viewport of VIEWPORTS) {
  test(`About this vehicle reads the variant, its specs and the purchase, at ${viewport.width}px`, async ({
    page,
  }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const nickname = `About ${suffix.slice(-4)}`;
    await page.setViewportSize(viewport);
    await registerAndSignIn(page, {
      name: `E2E About ${suffix}`,
      email: `e2e+about${suffix}@vehiclevault.dev`,
      password: 'VehicleVault!234',
    });
    const vehicleUrl = await createCatalogVehicle(page, {
      nickname,
      odometer: '15000',
      registrationNumber: `MH12AV${suffix.slice(-4)}`,
    });
    const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });

    // The seeded Creta SX has no spec sheet: one line says so.
    await page.getByRole('tab', { name: 'More' }).click();
    await page.getByRole('link', { name: /^About this vehicle/ }).click();
    const about = page.getByTestId('vehicle-about');
    await expect(about).toContainText('SX');
    const specsRow = page.getByTestId('about-specs');
    await expect(specsRow).toContainText("We don't have specs for this variant yet");
    await expect(specsRow.getByRole('link', { name: 'Pick a variant' })).toBeVisible();
    await expect(page.getByTestId('about-bought')).toContainText('No purchase date or price yet');
    await expectNoSidewaysScroll(page);
    if (SHOTS) await expect(page.getByText('Vehicle created')).toBeHidden({ timeout: 15_000 });
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/about-empty-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // Once the catalogue has them, the specs that matter read as one line.
    const existing = await prisma.vehicleCatalogVariantSpec.findUnique({
      where: { variantId: vehicle.catalogVariantId! },
    });
    expect(existing).toBeNull();
    const spec = await prisma.vehicleCatalogVariantSpec.create({
      data: {
        variantId: vehicle.catalogVariantId!,
        tyreSize: '215/60 R17',
        fuelCapLitres: 50,
        engineCc: 1497,
        engineFuel: 'Petrol',
        transmission: 'IVT',
        powerPs: 115,
      },
    });
    createdSpecIds.push(spec.id);
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { purchaseDate: new Date('2024-03-12T00:00:00.000Z'), purchasePrice: 1_450_000 },
    });

    await page.goto(`${vehicleUrl}?tab=more&section=about`);
    await expect(specsRow).toContainText('Tyres 215/60 R17 · Tank 50 L · 1,497 cc petrol · IVT');
    await expect(page.getByTestId('about-bought')).toContainText('12 Mar 2024 · ₹14,50,000');
    await page.getByRole('button', { name: 'Full spec sheet' }).click();
    await expect(page.getByText('Engine & drivetrain')).toBeVisible();
    await expectNoSidewaysScroll(page);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/about-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // An old link to Tech specs opens About this vehicle.
    await page.goto(`${vehicleUrl}?tab=specs`);
    await expect(page.getByTestId('vehicle-about')).toBeVisible();

    // Tyres shows the size, and adding tyres starts with it.
    await page.goto(`${vehicleUrl}?tab=more&section=tyres`);
    await expect(page.getByTestId('catalog-tyre-size')).toHaveText(
      'Size for this variant: 215/60 R17',
    );
    await page.getByRole('button', { name: 'Add tyres' }).click();
    await expect(page.getByRole('dialog').getByLabel('Size')).toHaveValue('215/60 R17');

    await prisma.vehicleCatalogVariantSpec.delete({ where: { id: spec.id } });
    createdSpecIds.splice(createdSpecIds.indexOf(spec.id), 1);
  });
}

test.afterAll(async () => {
  if (createdSpecIds.length > 0) {
    await prisma.vehicleCatalogVariantSpec.deleteMany({ where: { id: { in: createdSpecIds } } });
  }
  await prisma.$disconnect();
});

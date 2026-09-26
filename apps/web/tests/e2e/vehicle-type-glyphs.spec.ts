import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

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

let scooterVariantId = '';
let restoreBodyType: (() => Promise<unknown>) | null = null;

/** A seeded two-wheeler variant, marked a scooter for the length of this file. */
test.beforeAll(async () => {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: {} },
      generation: { model: { make: { vehicleType: 'motorcycle', marketCode: 'IN' } } },
    },
    include: { spec: true },
    orderBy: { slug: 'asc' },
  });
  scooterVariantId = variant.id;
  if (variant.spec) {
    const before = variant.spec.bodyType;
    await prisma.vehicleCatalogVariantSpec.update({
      where: { id: variant.spec.id },
      data: { bodyType: 'Scooter' },
    });
    restoreBodyType = () =>
      prisma.vehicleCatalogVariantSpec.update({
        where: { id: variant.spec!.id },
        data: { bodyType: before },
      });
  } else {
    const created = await prisma.vehicleCatalogVariantSpec.create({
      data: { variantId: variant.id, bodyType: 'Scooter' },
    });
    restoreBodyType = () => prisma.vehicleCatalogVariantSpec.delete({ where: { id: created.id } });
  }
});

/**
 * #356: one glyph set for the vehicle types, in garage rows, Quick log's
 * picker and the add-vehicle type field. A two-wheeler linked to a catalog
 * scooter is drawn as a scooter; one with no such link as a motorcycle.
 */
for (const viewport of VIEWPORTS) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`vehicle-type glyphs in the garage, Quick log and the type field, at ${viewport.width}px, ${scheme}`, async ({
      page,
    }) => {
      test.slow();
      const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const digits = suffix.slice(-4);
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      await registerAndSignIn(page, {
        name: `E2E Glyphs ${suffix}`,
        email: `e2e+glyphs${suffix}@vehiclevault.dev`,
        password: 'VehicleVault!234',
      });
      const vehicles = [
        {
          nickname: `Hatch ${digits}`,
          vehicleType: 'car',
          make: 'Maruti Suzuki',
          model: 'Swift',
          glyph: 'car',
        },
        {
          nickname: `Family ${digits}`,
          vehicleType: 'suv',
          make: 'Hyundai',
          model: 'Creta',
          glyph: 'suv',
        },
        {
          nickname: `Scooty ${digits}`,
          vehicleType: 'motorcycle',
          make: 'Scooterco',
          model: 'City',
          glyph: 'scooter',
          catalogVariantId: scooterVariantId,
        },
        {
          nickname: `Bullet ${digits}`,
          vehicleType: 'motorcycle',
          make: 'Bikeco',
          model: 'Tourer',
          glyph: 'motorcycle',
        },
      ];
      for (const [index, vehicle] of vehicles.entries()) {
        const { glyph: _glyph, ...data } = vehicle;
        await post(page, 'vehicles', {
          ...data,
          registrationNumber: `MH12G${'ABCD'[index]}${digits}`,
          year: 2023,
          fuelType: 'petrol',
          odometer: 5000,
        });
      }

      // Garage rows.
      await page.goto('/garage');
      const rows = page.getByRole('list', { name: 'Vehicles' });
      for (const vehicle of vehicles) {
        await expect(
          rows.getByRole('listitem').filter({ hasText: vehicle.nickname }).locator('[data-glyph]'),
          vehicle.nickname,
        ).toHaveAttribute('data-glyph', vehicle.glyph);
      }
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/glyphs-garage-${viewport.width}-${scheme}.png`,
          fullPage: true,
          animations: 'disabled',
        });

      // Quick log's vehicle picker.
      const logButton =
        viewport.width < 768
          ? page.getByTestId('bottom-nav').getByRole('button', { name: 'Log' })
          : page.getByRole('button', { name: 'Log', exact: true }).first();
      await page.goto('/home');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await logButton.click();
      await page
        .getByRole('dialog', { name: 'Log' })
        .getByRole('button', { name: 'Log fuel' })
        .click();
      const picker = page.getByRole('dialog', { name: 'Which vehicle?' });
      await expect(
        picker
          .getByRole('button')
          .filter({ hasText: `Scooty ${digits}` })
          .locator('[data-glyph]'),
      ).toHaveAttribute('data-glyph', 'scooter');
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/glyphs-quick-log-${viewport.width}-${scheme}.png`,
        });
      await page.keyboard.press('Escape');

      // The add-vehicle type field lists each type with its glyph.
      await page.goto('/vehicles/new');
      await page.getByLabel(/^vehicle type$/i).click();
      const options = page.getByRole('option');
      await expect(options.filter({ hasText: 'SUV' }).locator('[data-glyph]')).toHaveAttribute(
        'data-glyph',
        'suv',
      );
      await expect(
        options.filter({ hasText: /Motorcycle|Two-wheeler/ }).locator('[data-glyph]'),
      ).toHaveAttribute('data-glyph', 'motorcycle');
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/glyphs-type-field-${viewport.width}-${scheme}.png`,
        });
    });
  }
}

test.afterAll(async () => {
  await restoreBodyType?.();
  await prisma.$disconnect();
});

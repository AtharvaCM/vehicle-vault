import { expect, test } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { createCatalogVehicle } from './helpers/vehicle-form';

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** What this run changed in the shared catalog, so it can leave it as it found it. */
const createdSpecIds: string[] = [];
const changedSpecs: { id: string; mileageCombined: number | null }[] = [];

/**
 * What the vehicle actually returns against what it claims, measured between
 * fills. The fills go straight into the database: the fuel form has its own
 * coverage, and this is about the figure, not the typing.
 */
test('real km/L appears once there are two fills, beside the claim', async ({ page }) => {
  const suffix = uniqueSuffix();
  const nickname = `Economy ${suffix.slice(-4)}`;

  await registerAndSignIn(page, {
    name: `E2E Economy ${suffix}`,
    email: `e2e+economy${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  });
  await createCatalogVehicle(page, {
    nickname,
    odometer: '15000',
    registrationNumber: `MH12FE${suffix.slice(-4)}`,
  });
  const vehicleUrl = page.url();

  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { nickname } });
  expect(vehicle.catalogVariantId).not.toBeNull();
  const existingSpec = await prisma.vehicleCatalogVariantSpec.findUnique({
    where: { variantId: vehicle.catalogVariantId! },
  });
  if (existingSpec) {
    changedSpecs.push({ id: existingSpec.id, mileageCombined: existingSpec.mileageCombined });
    await prisma.vehicleCatalogVariantSpec.update({
      where: { id: existingSpec.id },
      data: { mileageCombined: 17.5 },
    });
  } else {
    const spec = await prisma.vehicleCatalogVariantSpec.create({
      data: { variantId: vehicle.catalogVariantId!, mileageCombined: 17.5 },
    });
    createdSpecIds.push(spec.id);
  }

  const logFill = (odometer: number, quantity: number, day: number) =>
    prisma.fuelLog.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(Date.UTC(2026, 8, day)),
        odometer,
        quantity,
        price: 105,
        totalCost: quantity * 105,
      },
    });

  // One fill: nothing to measure between yet, and the app says so.
  await logFill(15_000, 30, 1);
  await page.goto(`${vehicleUrl}?tab=fuel`);
  await expect(page.getByText(/One fill-up logged/)).toBeVisible();
  await expect(page.getByText(/Claimed 17\.5 km\/L/)).toBeVisible();

  // A second fill 450 km on: 450 km over the 30 L bought at it.
  await logFill(15_450, 30, 10);
  await page.reload();
  await expect(page.getByText('Real, over 450 km and 30 L')).toBeVisible();
  await expect(page.getByText('14% below the claim')).toBeVisible();
  await expect(page.getByText(/Soon: We/)).toHaveCount(0);

  // The overview carries the same figure.
  await page.goto(vehicleUrl);
  await expect(page.getByText('Real, over 450 km and 30 L')).toBeVisible();
});

test.afterAll(async () => {
  if (createdSpecIds.length > 0) {
    await prisma.vehicleCatalogVariantSpec.deleteMany({ where: { id: { in: createdSpecIds } } });
  }
  for (const spec of changedSpecs) {
    await prisma.vehicleCatalogVariantSpec.update({
      where: { id: spec.id },
      data: { mileageCombined: spec.mileageCombined },
    });
  }
  await prisma.$disconnect();
});

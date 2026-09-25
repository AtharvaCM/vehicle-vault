import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { skipVehicleSetupPrompt } from './helpers/vehicle-form';

const STORAGE_KEY = 'vehicle-vault.catalog-intent';

type SeededVariant = {
  id: string;
  path: string;
  makeName: string;
  modelName: string;
  modelSlug: string;
  variantName: string;
  /** The years its newest offering covers, up to this year. */
  firstYear: number;
  lastYear: number;
};

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function newAccount(tag: string) {
  const suffix = uniqueSuffix();
  return {
    suffix,
    name: `E2E Track ${suffix}`,
    email: `e2e+track-${tag}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  };
}

/** A seeded petrol car variant, found rather than hardcoded. */
async function seededCarVariant(): Promise<SeededVariant> {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: { fuelTypes: { has: 'petrol' } } },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: {
      offerings: { orderBy: [{ isCurrent: 'desc' }, { yearEnd: 'desc' }, { yearStart: 'desc' }] },
      generation: { include: { model: { include: { make: true } } } },
    },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  const { model } = generation;
  const { make } = model;
  const newest = variant.offerings[0];
  const thisYear = new Date().getFullYear();
  const lastYear = Math.min(thisYear, newest?.yearEnd ?? thisYear);

  return {
    id: variant.id,
    path: `/cars/${make.slug}/${model.slug}/${generation.slug}/${variant.slug}`,
    makeName: make.name,
    modelName: model.name,
    modelSlug: model.slug,
    variantName: variant.name,
    firstYear: Math.min(newest?.yearStart ?? lastYear, lastYear),
    lastYear,
  };
}

async function pressTrackThisVehicle(page: Page, variant: SeededVariant) {
  await page.goto(variant.path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Track this vehicle' }).click();
}

async function expectPrefilled(page: Page, variant: SeededVariant) {
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await expect(page.locator('#vehicle-make')).toContainText(variant.makeName);
  await expect(page.locator('#vehicle-model')).toContainText(variant.modelName);
  await expect(page.locator('#vehicle-variant')).toContainText(variant.variantName);
}

async function expectEmptyForm(page: Page) {
  await expect(page.locator('#vehicle-make')).toContainText('Select make');
  await expect(page.locator('#vehicle-variant')).toContainText('Select model first');
}

async function saveVehicle(page: Page, registrationNumber: string, nickname: string) {
  await page.getByLabel(/registration number/i).fill(registrationNumber);
  await page.getByLabel('Odometer', { exact: true }).fill('1200');
  await page.getByLabel(/nickname/i).fill(nickname);
  await page.getByRole('button', { name: /save vehicle/i }).click();

  await skipVehicleSetupPrompt(page);
  await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
  await expect(page.getByRole('heading', { name: nickname })).toBeVisible();
}

async function productEvent(email: string, name: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return prisma.productEvent.findFirstOrThrow({ where: { userId: user.id, name } });
}

test.describe('Track this vehicle', () => {
  let variant: SeededVariant;

  test.beforeAll(async () => {
    variant = await seededCarVariant();
  });

  test('a signed-out visitor registers and lands on the form with the vehicle chosen', async ({
    page,
  }) => {
    const account = newAccount('out');
    const nickname = `From catalog ${account.suffix.slice(-4)}`;

    await pressTrackThisVehicle(page, variant);

    // Kept for later, and gone from the address.
    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel(/^name$/i).fill(account.name);
    await page.getByLabel(/email address/i).fill(account.email);
    await page.getByLabel(/^password$/i).fill(account.password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Unverified, inside the week of grace, and straight on to the vehicle.
    await expectPrefilled(page, variant);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();

    await saveVehicle(page, `MH12TR${account.suffix.slice(-4)}`, nickname);

    const signup = await productEvent(account.email, 'account_created');
    expect(signup.properties).toEqual({
      method: 'password',
      source: 'catalog',
      catalogModel: variant.modelSlug,
    });
    const created = await productEvent(account.email, 'vehicle_created');
    expect(created.properties).toEqual({ fromCatalogIntent: true });
    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: created.vehicleId ?? '' },
      include: { catalogVariant: true },
    });
    expect(vehicle).toMatchObject({ make: variant.makeName, model: variant.modelName });
    expect(vehicle.catalogVariant?.name).toBe(variant.variantName);

    // Used once: the next vehicle starts from nothing.
    await page.goto('/vehicles/new');
    await expectEmptyForm(page);
  });

  test('a signed-in owner goes straight to the prefilled form', async ({ page }) => {
    const account = newAccount('in');
    const nickname = `Signed in ${account.suffix.slice(-4)}`;
    await registerAndSignIn(page, account);

    await pressTrackThisVehicle(page, variant);

    await expectPrefilled(page, variant);
    await expect(page.getByLabel(/^year$/i)).toHaveValue(String(variant.lastYear));

    // Correcting the year to another the variant was sold in keeps the pick.
    if (variant.firstYear !== variant.lastYear) {
      await page.getByLabel(/^year$/i).fill(String(variant.firstYear));
      await page.getByLabel(/^year$/i).press('Tab');
      await expect(page.locator('#vehicle-variant')).toContainText(variant.variantName);
    }

    await saveVehicle(page, `MH12TS${account.suffix.slice(-4)}`, nickname);

    const created = await productEvent(account.email, 'vehicle_created');
    expect(created.properties).toEqual({ fromCatalogIntent: true });
    // Registered the ordinary way, before the catalog page.
    const signup = await productEvent(account.email, 'account_created');
    expect(signup.properties).toEqual({ method: 'password' });

    await page.goto('/vehicles/new');
    await expectEmptyForm(page);
  });

  test('an owner with an account who signs in from registration lands on the prefilled form', async ({
    page,
  }) => {
    const account = newAccount('login');
    await registerAndSignIn(page, account);
    // Signed out on this device.
    await page.evaluate(() => localStorage.removeItem('vehicle-vault.auth-session'));

    await pressTrackThisVehicle(page, variant);
    await expect(page).toHaveURL(/\/register$/);
    // The card's link, which keeps the intent; the header's Sign in is plain.
    await page
      .locator('p', { hasText: 'Already have an account?' })
      .getByRole('link', { name: 'Sign in', exact: true })
      .click();

    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel(/email address/i).fill(account.email);
    await page.getByLabel(/^password$/i).fill(account.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expectPrefilled(page, variant);
  });

  test('an intent the catalog cannot resolve, or one past its expiry, is dropped quietly', async ({
    page,
  }) => {
    const account = newAccount('gone');
    await registerAndSignIn(page, account);

    await page.goto('/vehicles/new?catalog=%2Fcars%2Fno-such-make%2Fno-such-model%2Fgen%2Fvariant');
    await expect(page).toHaveURL(/\/vehicles\/new$/);
    await expectEmptyForm(page);
    await expect(page.getByText(/something went wrong|not found/i)).toHaveCount(0);

    const [segment, make, model, generation, variantSlug] = variant.path.slice(1).split('/');
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: STORAGE_KEY,
      value: JSON.stringify({
        version: 1,
        intent: { segment, make, model, generation, variant: variantSlug },
        savedAt: eightDaysAgo,
      }),
    });
    await page.goto('/vehicles/new');
    await expectEmptyForm(page);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

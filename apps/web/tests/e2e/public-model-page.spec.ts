import { expect, test, type Page } from '@playwright/test';

import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';

const PHONE = { width: 375, height: 812 };
const STORAGE_KEY = 'vehicle-vault.catalog-intent';

/** A generation this spec adds under the seeded model, so the page has two to group. */
const OLDER_GENERATION = {
  name: 'E2E older generation',
  slug: 'e2e-older-generation',
  variantName: 'E2E Classic',
  variantSlug: 'e2e-classic',
};

type SeededModel = {
  id: string;
  path: string;
  makeName: string;
  modelName: string;
  modelSlug: string;
  currentGenerationName: string;
  /** Variant names in the current generation, as the page sorts them. */
  currentVariants: string[];
};

/** A catalog name inside a pattern: "Asta (O)" has to match itself. */
function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function newAccount(tag: string) {
  const suffix = uniqueSuffix();
  return {
    suffix,
    name: `E2E Model ${suffix}`,
    email: `e2e+model-${tag}${suffix}@vehiclevault.dev`,
    password: 'VehicleVault!234',
  };
}

/** A seeded car model with a current generation of several variants on sale, found rather than hardcoded. */
async function seededCarModel(): Promise<SeededModel> {
  const model = await prisma.vehicleCatalogModel.findFirstOrThrow({
    where: {
      make: { vehicleType: 'car', marketCode: 'IN' },
      generations: {
        some: {
          isCurrent: true,
          variants: {
            some: { offerings: { some: { isCurrent: true, fuelTypes: { has: 'petrol' } } } },
          },
        },
      },
    },
    include: {
      make: true,
      generations: { where: { isCurrent: true }, include: { variants: true } },
    },
    orderBy: { slug: 'asc' },
  });
  const [generation] = model.generations as {
    name: string;
    variants: { name: string }[];
  }[];
  if (!generation) throw new Error('The seeded model has no current generation.');

  return {
    id: model.id,
    path: `/cars/${model.make.slug}/${model.slug}`,
    makeName: model.make.name,
    modelName: model.name,
    modelSlug: model.slug,
    currentGenerationName: generation.name,
    currentVariants: generation.variants
      .map((variant) => variant.name)
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })),
  };
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'the page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

async function expectModelPrefilled(page: Page, model: SeededModel) {
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await expect(page.locator('#vehicle-make')).toContainText(model.makeName);
  await expect(page.locator('#vehicle-model')).toContainText(model.modelName);
  // The variant is left for the owner: optional, and not guessed.
  await expect(page.locator('#vehicle-variant')).toContainText('Select variant, or skip');
  await expect(page.getByLabel(/^year$/i)).toHaveValue(String(new Date().getFullYear()));
}

async function productEvent(email: string, name: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return prisma.productEvent.findFirstOrThrow({ where: { userId: user.id, name } });
}

test.describe('public model page', () => {
  let model: SeededModel;

  test.beforeAll(async () => {
    model = await seededCarModel();
    await prisma.vehicleCatalogGeneration.deleteMany({
      where: { modelId: model.id, slug: OLDER_GENERATION.slug },
    });
    await prisma.vehicleCatalogGeneration.create({
      data: {
        modelId: model.id,
        name: OLDER_GENERATION.name,
        slug: OLDER_GENERATION.slug,
        yearStart: 2012,
        yearEnd: 2019,
        isCurrent: false,
        variants: {
          create: {
            name: OLDER_GENERATION.variantName,
            slug: OLDER_GENERATION.variantSlug,
            offerings: {
              create: { fuelTypes: ['diesel'], yearStart: 2012, yearEnd: 2019, isCurrent: false },
            },
          },
        },
      },
    });
  });

  test.afterAll(async () => {
    await prisma.vehicleCatalogGeneration.deleteMany({
      where: { modelId: model.id, slug: OLDER_GENERATION.slug },
    });
    await prisma.$disconnect();
  });

  test('a signed-out visitor on a phone sees the variants by generation, opens one and comes back', async ({
    page,
  }) => {
    const heading = `${model.makeName} ${model.modelName}`;
    await page.setViewportSize(PHONE);
    await page.goto(model.path);

    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${literal(heading)} — variants`));

    // Current generation first, then the older one this spec added.
    const variants = page.getByRole('region', { name: 'Variants' });
    await expect(variants.getByRole('heading', { level: 3 })).toHaveText([
      model.currentGenerationName,
      OLDER_GENERATION.name,
    ]);
    const current = page.getByRole('region', { name: model.currentGenerationName });
    await expect(current.getByText('Current', { exact: true })).toBeVisible();
    await expect(current.getByRole('link')).toHaveCount(model.currentVariants.length);
    const older = page.getByRole('region', { name: OLDER_GENERATION.name });
    await expect(older.getByRole('link')).toHaveText([
      new RegExp(`${literal(heading)} ${OLDER_GENERATION.variantName}.*Diesel · 2012 – 2019`),
    ]);

    await expect(page.getByText(`Shown for the ${heading} `)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expectNoSidewaysScroll(page);

    const [firstVariant] = model.currentVariants;
    await current
      .getByRole('link', { name: new RegExp(`^${literal(`${heading} ${firstVariant}`)}`) })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: `${heading} ${firstVariant}` }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`^[^?]*${model.path}/[^/]+/[^/]+$`));
    await expectNoSidewaysScroll(page);

    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: model.modelName, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${model.path}$`));
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${literal(heading)} — variants`));
  });

  test('the API serves the model page without a token and with public cache headers', async ({
    request,
  }) => {
    const response = await request.get(`/api/public-catalog${model.path}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('public, max-age=3600');
    const body = (await response.json()) as {
      data: { generations: { slug: string; isCurrent: boolean }[] };
    };
    expect(body.data.generations.map((generation) => generation.isCurrent)).toEqual([true, false]);
    expect(JSON.stringify(body)).not.toContain('sourceUrl');
  });

  test('an unknown model gets the not-found screen, not a crash', async ({ page }) => {
    await page.goto('/cars/no-such-make/no-such-model');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('Track this vehicle, signed out: register, then add-vehicle with make and model, variant empty', async ({
    page,
  }) => {
    const account = newAccount('out');
    const nickname = `From model ${account.suffix.slice(-4)}`;
    await page.setViewportSize(PHONE);
    await page.goto(model.path);
    await page.getByRole('link', { name: 'Track this vehicle' }).click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByLabel(/^name$/i).fill(account.name);
    await page.getByLabel(/email address/i).fill(account.email);
    await page.getByLabel(/^password$/i).fill(account.password);
    await page.getByRole('button', { name: /create account/i }).click();

    await expectModelPrefilled(page, model);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();

    await page.getByLabel(/registration number/i).fill(`MH12MP${account.suffix.slice(-4)}`);
    await page.getByLabel('Odometer', { exact: true }).fill('1200');
    await page.getByLabel(/nickname/i).fill(nickname);
    await page.getByRole('button', { name: /save vehicle/i }).click();
    await expect(page).toHaveURL(/\/vehicles\/[^/]+$/);
    await expect(page.getByRole('heading', { name: nickname })).toBeVisible();

    const signup = await productEvent(account.email, 'account_created');
    expect(signup.properties).toEqual({
      method: 'password',
      source: 'catalog',
      catalogModel: model.modelSlug,
    });
    const created = await productEvent(account.email, 'vehicle_created');
    expect(created.properties).toEqual({ fromCatalogIntent: true });
    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: created.vehicleId ?? '' },
    });
    expect(vehicle).toMatchObject({ make: model.makeName, model: model.modelName });
    expect(vehicle.variant || null).toBeNull();
  });

  test('Track this vehicle, signed in: straight to add-vehicle with make and model, variant empty', async ({
    page,
  }) => {
    const account = newAccount('in');
    await registerAndSignIn(page, account);
    await page.setViewportSize(PHONE);

    await page.goto(model.path);
    await expect(page.getByRole('link', { name: 'Open your garage' })).toBeVisible();
    await page.getByRole('link', { name: 'Track this vehicle' }).click();

    await expectModelPrefilled(page, model);
  });
});

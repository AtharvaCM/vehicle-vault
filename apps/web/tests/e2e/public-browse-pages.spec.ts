import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

const PHONE = { width: 375, height: 812 };

/** A catalog name inside a pattern: "Asta (O)" has to match itself. */
function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CatalogMake = {
  slug: string;
  name: string;
  /** Model names across every make row with this slug, by vehicle type. */
  modelsByType: Map<string, string[]>;
  /** One model from a row other than the first, with its variant names. */
  otherRowModel: { name: string; slug: string; variants: string[] };
};

/**
 * A seeded India make with public pages under `/cars` from more than one make
 * row (the seed has Hyundai as both a car and an SUV make, with one slug).
 * Found rather than hardcoded.
 */
async function makeWithSeveralRows(): Promise<CatalogMake> {
  const rows = (await prisma.vehicleCatalogMake.findMany({
    where: { marketCode: 'IN', vehicleType: { in: ['car', 'suv', 'van'] } },
    include: {
      models: {
        where: { generations: { some: { variants: { some: { offerings: { some: {} } } } } } },
        include: { generations: { include: { variants: true } } },
      },
    },
    orderBy: [{ slug: 'asc' }, { vehicleType: 'asc' }],
  })) as {
    slug: string;
    name: string;
    vehicleType: string;
    models: {
      name: string;
      slug: string;
      generations: { variants: { name: string }[] }[];
    }[];
  }[];
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.models.length === 0) continue;
    bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row]);
  }
  const merged = [...bySlug.values()].find((makeRows) => makeRows.length > 1);
  if (!merged) throw new Error('The seed has no make with more than one public make row.');

  const [first, second] = merged as [(typeof rows)[number], (typeof rows)[number]];
  const other = second.models[0]!;
  return {
    slug: first.slug,
    name: first.name,
    modelsByType: new Map(merged.map((row) => [row.vehicleType, row.models.map((m) => m.name)])),
    otherRowModel: {
      name: other.name,
      slug: other.slug,
      variants: other.generations.flatMap((generation) =>
        generation.variants.map((variant) => variant.name),
      ),
    },
  };
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'the page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

const breadcrumbs = (page: Page) => page.getByRole('navigation', { name: 'Breadcrumb' });

test.describe('public make and browse pages', () => {
  let make: CatalogMake;

  test.beforeAll(async () => {
    make = await makeWithSeveralRows();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('on a phone: landing → cars → a make → a model → a variant, and breadcrumbs back up', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('link', { name: 'Browse cars' }).click();

    // Browse: every make once, whatever rows it has.
    await expect(page).toHaveURL(/\/cars$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Cars by make' })).toBeVisible();
    await expect(page).toHaveTitle(/^Cars by make — /);
    const makes = page.getByRole('region', { name: 'Makes' });
    await expect(
      makes.getByRole('link', { name: new RegExp(`^${literal(make.name)}`) }),
    ).toHaveCount(1);
    await expectNoSidewaysScroll(page);

    // Make: the models of every row with its slug.
    await makes.getByRole('link', { name: new RegExp(`^${literal(make.name)}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/cars/${make.slug}$`));
    await expect(page.getByRole('heading', { level: 1, name: `${make.name} cars` })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${literal(make.name)} cars — `));
    for (const modelName of [...make.modelsByType.values()].flat()) {
      await expect(
        page.getByRole('link', { name: new RegExp(`^${literal(`${make.name} ${modelName}`)}`) }),
      ).toBeVisible();
    }
    await expect(breadcrumbs(page).getByRole('link', { name: 'Cars' })).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Model: one from the make's second row.
    const modelHeading = `${make.name} ${make.otherRowModel.name}`;
    await page.getByRole('link', { name: new RegExp(`^${literal(modelHeading)}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/cars/${make.slug}/${make.otherRowModel.slug}$`));
    await expect(page.getByRole('heading', { level: 1, name: modelHeading })).toBeVisible();
    await expectNoSidewaysScroll(page);

    // Variant.
    await page
      .getByRole('region', { name: 'Variants' })
      .getByRole('link', { name: new RegExp(`^${literal(modelHeading)} `) })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/cars/${make.slug}/${make.otherRowModel.slug}/[^/]+/[^/]+$`),
    );
    const variantHeading = page.getByRole('heading', { level: 1 });
    await expect(variantHeading).toHaveText(new RegExp(`^${literal(modelHeading)} `));
    await expect(breadcrumbs(page).getByRole('link')).toHaveText([
      'Cars',
      make.name,
      make.otherRowModel.name,
    ]);
    await expect(breadcrumbs(page).locator('[aria-current="page"]')).toHaveCount(1);
    await expectNoSidewaysScroll(page);

    // Back up, one crumb at a time.
    await breadcrumbs(page)
      .getByRole('link', { name: make.otherRowModel.name, exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: modelHeading })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${literal(modelHeading)} — variants`));

    await breadcrumbs(page).getByRole('link', { name: make.name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: `${make.name} cars` })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/cars/${make.slug}$`));

    await breadcrumbs(page).getByRole('link', { name: 'Cars', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cars by make' })).toBeVisible();
    await expect(page).toHaveURL(/\/cars$/);
  });

  test('bikes have their own browse page, reachable from the landing page', async ({ page }) => {
    const bikeMake = await prisma.vehicleCatalogMake.findFirstOrThrow({
      where: {
        marketCode: 'IN',
        vehicleType: 'motorcycle',
        models: {
          some: { generations: { some: { variants: { some: { offerings: { some: {} } } } } } },
        },
      },
      orderBy: { slug: 'asc' },
    });
    await page.setViewportSize(PHONE);
    await page.goto('/');
    await page.getByRole('link', { name: 'Browse bikes' }).click();

    await expect(page).toHaveURL(/\/bikes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bikes by make' })).toBeVisible();
    await page
      .getByRole('region', { name: 'Makes' })
      .getByRole('link', { name: new RegExp(`^${literal(bikeMake.name)}`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/bikes/${bikeMake.slug}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: `${bikeMake.name} bikes` }),
    ).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  test('the API serves make and browse pages without a token, and keeps the index route', async ({
    request,
  }) => {
    const browse = await request.get('/api/public-catalog/cars');
    expect(browse.status()).toBe(200);
    expect(browse.headers()['cache-control']).toBe('public, max-age=3600');
    const browseBody = (await browse.json()) as { data: { makes: { slug: string }[] } };
    expect(browseBody.data.makes.filter((entry) => entry.slug === make.slug)).toHaveLength(1);

    const makePage = await request.get(`/api/public-catalog/cars/${make.slug}`);
    expect(makePage.status()).toBe(200);
    expect(makePage.headers()['cache-control']).toBe('public, max-age=3600');
    const makeBody = (await makePage.json()) as { data: { models: { name: string }[] } };
    expect(makeBody.data.models.map((model) => model.name).sort()).toEqual(
      [...make.modelsByType.values()].flat().sort(),
    );
    expect(JSON.stringify(makeBody)).not.toContain('sourceUrl');

    // The fixed routes still win over `:segment`.
    const index = await request.get('/api/public-catalog/index');
    expect(index.status()).toBe(200);
    expect(
      Array.isArray(((await index.json()) as { data: { variants: unknown } }).data.variants),
    ).toBe(true);
    expect((await request.get('/api/public-catalog/trucks')).status()).toBe(404);
  });

  test('an unknown make gets the not-found screen, not a crash', async ({ page }) => {
    await page.goto('/cars/no-such-make');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

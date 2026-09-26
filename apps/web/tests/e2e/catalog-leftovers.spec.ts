import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const PUBLISHABLE = { offerings: { some: {} } };

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/catalog-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/** A make slug with public pages among both cars and bikes, found rather than hardcoded. */
async function makeInBothSegments() {
  const bikeMakes = await prisma.vehicleCatalogMake.findMany({
    where: {
      marketCode: 'IN',
      vehicleType: 'motorcycle',
      models: { some: { generations: { some: { variants: { some: PUBLISHABLE } } } } },
    },
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  });
  for (const bike of bikeMakes) {
    const car = await prisma.vehicleCatalogMake.findFirst({
      where: {
        slug: bike.slug,
        marketCode: 'IN',
        vehicleType: { in: ['car', 'suv', 'van'] },
        models: { some: { generations: { some: { variants: { some: PUBLISHABLE } } } } },
      },
    });
    if (car) return { slug: bike.slug, name: car.name };
  }
  throw new Error('The seed has no make among both cars and bikes.');
}

/** A car model whose only generation name was made up by the import ("{Model} lineup"). */
async function modelWithMadeUpGeneration() {
  const generations = await prisma.vehicleCatalogGeneration.findMany({
    where: {
      name: { endsWith: ' lineup' },
      variants: { some: PUBLISHABLE },
      model: { make: { marketCode: 'IN', vehicleType: 'car' } },
    },
    include: { model: { include: { make: true } } },
    orderBy: { slug: 'asc' },
  });
  const generation = generations.find(
    (candidate) => candidate.name.toLowerCase() === `${candidate.model.name} lineup`.toLowerCase(),
  );
  if (!generation) throw new Error('The seed has no made-up generation name.');
  return {
    path: `/cars/${generation.model.make.slug}/${generation.model.slug}`,
    madeUp: generation.name,
  };
}

let restoreBodyType: (() => Promise<unknown>) | null = null;
let scooterPath = '';

/** A seeded two-wheeler variant with a typical schedule, marked a scooter for this file. */
test.beforeAll(async () => {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      ...PUBLISHABLE,
      serviceIntervals: { none: {} },
      generation: { model: { make: { vehicleType: 'motorcycle', marketCode: 'IN' } } },
    },
    include: { spec: true, generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  scooterPath = `/bikes/${generation.model.make.slug}/${generation.model.slug}/${generation.slug}/${variant.slug}`;
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
 * #371: a segmented Cars / Bikes control on the browse pages; no made-up
 * generation names on a model page; a scooter's schedule named a scooter's;
 * a make page linking the same make's other segment; and a freshness line at
 * the end of every make, model and variant page.
 */
for (const viewport of VIEWPORTS) {
  test(`catalog leftovers, at ${viewport.width}px`, async ({ page }) => {
    test.slow();
    await page.setViewportSize(viewport);
    const main = page.getByRole('main');

    // Browse: one segmented control.
    await page.goto('/cars');
    const segments = main.getByRole('navigation', { name: 'Cars or bikes' });
    await expect(segments.getByRole('link', { name: 'Cars' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(main.getByRole('link', { name: 'Browse bikes' })).toHaveCount(0);
    await shoot(page, 'browse', viewport.width);
    await segments.getByRole('link', { name: 'Bikes' }).click();
    await expect(page).toHaveURL(/\/bikes$/);
    await expect(segments.getByRole('link', { name: 'Bikes' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // A make in both segments links the other.
    const make = await makeInBothSegments();
    await page.goto(`/cars/${make.slug}`);
    await expect(main.getByRole('link', { name: `${make.name} bikes` })).toHaveAttribute(
      'href',
      `/bikes/${make.slug}`,
    );
    await expect(main.getByTestId('catalog-freshness')).toContainText('Details last updated');
    await shoot(page, 'make', viewport.width);

    // A model page never heads its variants with a made-up name.
    const model = await modelWithMadeUpGeneration();
    await page.goto(model.path);
    await expect(main.getByRole('heading', { level: 2, name: 'Variants' })).toBeVisible();
    await expect(main.getByRole('heading', { level: 3, name: model.madeUp })).toHaveCount(0);
    await expect(main.getByTestId('catalog-freshness')).toBeVisible();
    await shoot(page, 'model', viewport.width);

    // A scooter's typical schedule is a scooter's.
    await page.goto(scooterPath);
    await expect(
      main.getByRole('heading', { level: 2, name: /^Typical schedule for an? .*scooter$/ }),
    ).toBeVisible();
    await expect(main.getByText(/Typical schedule for an? .*motorcycle/)).toHaveCount(0);
    await expect(main.getByTestId('catalog-freshness')).toBeVisible();
    await shoot(page, 'scooter', viewport.width);
  });
}

test.afterAll(async () => {
  await restoreBodyType?.();
  await prisma.$disconnect();
});

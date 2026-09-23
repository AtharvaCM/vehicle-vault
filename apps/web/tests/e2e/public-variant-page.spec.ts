import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

const PHONE = { width: 375, height: 812 };

type SeededVariant = {
  id: string;
  path: string;
  heading: string;
};

/**
 * A seeded petrol car variant, with a spec row of our own so the specs section
 * has something to show. The catalog seed carries no specs.
 */
async function seededCarVariant(): Promise<SeededVariant> {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: { fuelTypes: { has: 'petrol' } } },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  const { model } = generation;
  const { make } = model;

  return {
    id: variant.id,
    path: `/cars/${make.slug}/${model.slug}/${generation.slug}/${variant.slug}`,
    heading: `${make.name} ${model.name} ${variant.name}`,
  };
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'the page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

test.describe('public variant page', () => {
  let variant: SeededVariant;

  test.beforeAll(async () => {
    variant = await seededCarVariant();
    await prisma.vehicleCatalogVariantSpec.upsert({
      where: { variantId: variant.id },
      create: {
        variantId: variant.id,
        engineCc: 1197,
        powerPs: 83,
        powerRpm: 6000,
        transmission: 'Manual',
        mileageCombined: 20.3,
        tyreSize: '195/55 R16',
      },
      update: {},
    });
  });

  test('a signed-out visitor on a phone sees the schedule and specs, with no sign-in prompt', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto(variant.path);

    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    await expect(page).toHaveURL(variant.path);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Typical schedule for a petrol car' }),
    ).toBeVisible();
    await expect(page.getByText('Periodic Service')).toBeVisible();
    // A petrol car gets an oil change and a timing belt, and no chain service.
    await expect(page.getByText('Engine Oil')).toBeVisible();
    await expect(page.getByText('Timing Belt')).toBeVisible();
    await expect(page.getByText('Chain Service')).toHaveCount(0);

    const engine = page.getByRole('region', { name: 'Engine and drivetrain' });
    await expect(engine.getByText('1,197 cc')).toBeVisible();
    await expect(engine.getByText('Cylinders')).toHaveCount(0);

    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveCount(0);
    await expectNoSidewaysScroll(page);
  });

  test('the API serves the page without a token and with public cache headers', async ({
    request,
  }) => {
    const response = await request.get(`/api/public-catalog${variant.path}`);

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('public, max-age=3600');
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(JSON.stringify(body)).not.toContain('sourceUrl');
  });

  test('an unknown variant gets the not-found screen, not a crash', async ({ page }) => {
    await page.goto('/cars/no-such-make/no-such-model/no-such-generation/no-such-variant');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});

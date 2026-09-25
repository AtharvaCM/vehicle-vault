import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

const PHONE = { width: 375, height: 812 };

/**
 * A seeded petrol car variant with a claimed mileage of our own, so the
 * calculator has something to start from. The catalog seed carries no specs.
 */
async function seededCarVariantPath() {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: { fuelTypes: { has: 'petrol' } } },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  await prisma.vehicleCatalogVariantSpec.upsert({
    where: { variantId: variant.id },
    create: { variantId: variant.id, mileageCombined: 20.3 },
    update: { mileageCombined: 20.3 },
  });

  const { generation } = variant;
  const { model } = generation;
  return `/cars/${model.make.slug}/${model.slug}/${generation.slug}/${variant.slug}`;
}

async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, 'the page is wider than the screen').toBeLessThanOrEqual(clientWidth);
}

test.describe('running-cost calculator on the public variant page', () => {
  let path: string;

  test.beforeAll(async () => {
    path = await seededCarVariantPath();
  });

  test('a visitor on a phone fills it in, sees the totals, and finds them again after a reload', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto(path);

    const calculator = page.getByRole('region', { name: 'What it costs to run' });
    await expect(calculator).toBeVisible();
    // It opens on the claimed mileage and a default petrol price, both marked as assumed.
    await expect(calculator.getByLabel('Mileage')).toHaveValue('20.3');
    await expect(calculator.getByLabel('Petrol price')).toHaveValue('103');
    await expect(calculator.getByText('Assumed, not entered:')).toBeVisible();

    await calculator.getByLabel('Distance per month').fill('1500');
    await calculator.getByLabel('Petrol price').fill('100');
    await calculator.getByLabel('On-road price (optional)').fill('8,00,000');

    const perMonth = calculator.getByRole('region', { name: 'Per month' });
    // 1,500 km ÷ 20.3 km/L × ₹100: the running cost is fuel and service, never the price.
    await expect(perMonth.getByRole('definition').first()).toHaveText('₹7,389');
    await expect(perMonth.getByRole('definition')).toHaveCount(2);
    await expect(calculator.getByRole('region', { name: 'Per year' })).toBeVisible();
    // The price goes into the cost of owning it, apart, with an assumed resale.
    const owning = calculator.getByRole('region', { name: 'Cost of owning it over 5 years' });
    await expect(owning.getByRole('definition').first()).toHaveText('₹8,00,000');
    await expect(owning).toContainText('assumed, 44% kept');
    await expect(calculator).not.toContainText('NaN');
    const totalBefore = await perMonth.locator('p').first().textContent();
    await expectNoSidewaysScroll(page);

    await page.reload();

    await expect(calculator.getByLabel('Distance per month')).toHaveValue('1500');
    await expect(calculator.getByLabel('Petrol price')).toHaveValue('100');
    await expect(calculator.getByLabel('On-road price (optional)')).toHaveValue('8,00,000');
    await expect(perMonth.locator('p').first()).toHaveText(totalBefore ?? '');
    await expectNoSidewaysScroll(page);

    // Nonsense input gets a plain "can't estimate", not NaN.
    await calculator.getByLabel('Distance per month').fill('0');
    await expect(calculator.getByRole('heading', { name: 'Can’t estimate yet' })).toBeVisible();
    await expect(calculator).not.toContainText('NaN');
    await expectNoSidewaysScroll(page);
  });

  test('the calculator still works when the browser blocks localStorage', async ({ page }) => {
    // What Safari does with all cookies blocked: touching either store throws.
    await page.addInitScript(() => {
      for (const store of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, store, {
          configurable: true,
          get() {
            throw new DOMException('The operation is insecure.', 'SecurityError');
          },
        });
      }
    });
    await page.setViewportSize(PHONE);
    await page.goto(path);

    const calculator = page.getByRole('region', { name: 'What it costs to run' });
    await calculator.getByLabel('Distance per month').fill('1500');
    await calculator.getByLabel('Petrol price').fill('100');

    await expect(
      calculator.getByRole('region', { name: 'Per month' }).getByRole('definition').first(),
    ).toHaveText('₹7,389');
  });
});

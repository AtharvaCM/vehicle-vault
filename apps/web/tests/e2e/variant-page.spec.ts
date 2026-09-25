import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/** A seeded car variant with siblings in its generation, found rather than hardcoded. */
async function variantWithSiblings() {
  const candidates = await prisma.vehicleCatalogVariant.findMany({
    where: {
      offerings: { some: {} },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: {
      generation: {
        include: {
          model: { include: { make: true } },
          variants: { where: { offerings: { some: {} } }, select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { slug: 'asc' },
  });
  const variant = candidates.find((candidate) => candidate.generation.variants.length > 1);
  if (!variant) throw new Error('No seeded car variant has a sibling.');
  const { generation } = variant;
  const { model } = generation;
  return {
    path: `/cars/${model.make.slug}/${model.slug}/${generation.slug}/${variant.slug}`,
    heading: `${model.make.name} ${model.name} ${variant.name}`,
    makeName: model.make.name,
    modelName: model.name,
    variantName: variant.name,
    siblings: generation.variants.filter((sibling) => sibling.slug !== variant.slug),
  };
}

/**
 * #344: a variant page leads with its key facts (honest gaps included), links
 * its siblings, opens a clean running-cost calculator that leaves the price
 * out, and keeps Track this vehicle in reach on a phone, carrying the vehicle
 * into registration.
 */
for (const viewport of VIEWPORTS) {
  test(`a variant page leads with key facts and keeps Track in reach, at ${viewport.width}px`, async ({
    page,
  }) => {
    const variant = await variantWithSiblings();
    expect(variant.siblings.length).toBeGreaterThan(0);
    await page.setViewportSize(viewport);
    await page.goto(variant.path);

    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    const facts = page.getByRole('region', { name: 'Key facts' });
    await expect(facts.getByText('Price')).toBeVisible();
    await expect(facts).toContainText('Not in our data yet');
    await expect(facts.getByText('Fuel')).toBeVisible();
    const others = page.getByRole('navigation', { name: 'Other variants' });
    await expect(others.getByRole('link')).toHaveCount(variant.siblings.length);

    // The calculator opens with nothing marked wrong, and an estimate showing.
    const calculator = page.getByRole('region', { name: 'What it costs to run' });
    await expect(calculator.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(calculator.getByText('Can’t estimate yet')).toHaveCount(0);
    await expect(calculator.getByRole('region', { name: 'Per month' })).toBeVisible();

    const bar = page.getByTestId('track-this-vehicle-bar');
    if (viewport.width < 768) await expect(bar).toBeVisible();
    else await expect(bar).toBeHidden();
    await expectNoSidewaysScroll(page, `variant page at ${viewport.width}px`);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/variant-${viewport.width}.png` });
      await page.screenshot({
        path: `${SHOTS}/variant-full-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }

    // A sibling link goes to that variant's page.
    const sibling = variant.siblings[0]!;
    await others.getByRole('link', { name: sibling.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${sibling.slug}$`));
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();

    // Track: the phone's bar, or the page's own offer; registration names the vehicle.
    if (viewport.width < 768) await bar.getByRole('link').click();
    else await page.getByRole('link', { name: 'Track this vehicle' }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('catalog-intent-card')).toContainText(
      `${variant.makeName} ${variant.modelName} · ${variant.variantName}`,
    );
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

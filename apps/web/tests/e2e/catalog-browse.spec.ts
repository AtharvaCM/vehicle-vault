import { expect, test, type Page } from '@playwright/test';

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

async function shoot(page: Page, name: string, width: number) {
  if (SHOTS)
    await page.screenshot({
      path: `${SHOTS}/catalog-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
}

/**
 * #345: the browse page is the catalog's front door. It says how much it
 * holds, searches makes and models, tiles the makes, offers popular models and
 * the owner's Track your vehicle; make and model pages list cards, and each
 * page makes the owner offer.
 */
for (const viewport of VIEWPORTS) {
  test(`browse, make and model pages lead to a model and offer to track it, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/cars');

    await expect(page.getByRole('heading', { level: 1, name: 'Cars in India' })).toBeVisible();
    await expect(
      page.getByText(/^Service intervals and running costs for \d+ models from \d+ makers\.$/),
    ).toBeVisible();
    const makes = page.getByRole('region', { name: 'Makes' });
    await expect(makes.getByRole('link', { name: /^Honda/ })).toHaveAttribute(
      'href',
      '/cars/honda',
    );
    // The seeded catalog has these; their chips lead to the model pages.
    const popular = page.getByRole('region', { name: 'Popular models' });
    await expect(popular.getByRole('link', { name: 'Hyundai Creta' })).toHaveAttribute(
      'href',
      '/cars/hyundai/creta',
    );
    const offer = page.getByRole('region', { name: 'Own one already?' });
    await expect(offer.getByRole('link', { name: 'Track your vehicle' })).toHaveAttribute(
      'href',
      '/register',
    );
    await expectNoSidewaysScroll(page, `browse at ${viewport.width}px`);
    await shoot(page, 'browse', viewport.width);

    // Search finds a model by name, and by words from its make and model.
    const search = page.getByLabel('Search makes and models');
    await search.fill('nexon');
    const matches = page.getByRole('list', { name: 'Matches' });
    await expect(matches.getByRole('link')).toHaveCount(1);
    await search.fill('maruti swift');
    await expect(matches.getByRole('link', { name: /Maruti Suzuki Swift/ })).toHaveAttribute(
      'href',
      '/cars/maruti-suzuki/swift',
    );
    await search.fill('amaze');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/catalog-search-${viewport.width}.png` });
    await matches.getByRole('link', { name: /Honda Amaze/ }).click();

    // The model page: variant cards, and a way to the offer from the top.
    await expect(page).toHaveURL(/\/cars\/honda\/amaze$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Honda Amaze' })).toBeVisible();
    await page.getByRole('link', { name: 'Own one? Track it free' }).click();
    await expect(page.getByRole('region', { name: 'Own a Honda Amaze?' })).toBeInViewport();
    await expectNoSidewaysScroll(page, `model at ${viewport.width}px`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, 'model', viewport.width);

    // The make page: model cards, and the owner offer for the make.
    await page.goto('/cars/honda');
    const onSale = page.getByRole('region', { name: 'On sale' });
    await expect(onSale.getByRole('link', { name: /^Honda City / })).toHaveAttribute(
      'href',
      '/cars/honda/city',
    );
    await expect(
      page
        .getByRole('region', { name: 'Own a Honda?' })
        .getByRole('link', { name: 'Track your Honda' }),
    ).toHaveAttribute('href', '/register');
    await expectNoSidewaysScroll(page, `make at ${viewport.width}px`);
    await shoot(page, 'make', viewport.width);
  });
}

test('bikes have their own front door, with their popular models', async ({ page }) => {
  await page.goto('/bikes');
  await expect(page.getByRole('heading', { level: 1, name: 'Bikes in India' })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Popular models' }).getByRole('link', {
      name: 'Royal Enfield Classic 350',
    }),
  ).toHaveAttribute('href', '/bikes/royal-enfield/classic-350');
  await page.getByLabel('Search makes and models').fill('jupiter');
  await expect(
    page.getByRole('list', { name: 'Matches' }).getByRole('link', { name: /TVS Jupiter/ }),
  ).toHaveAttribute('href', '/bikes/tvs/jupiter');
});

import { expect, test, type Page } from '@playwright/test';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const HONDA = { name: 'Honda', slug: 'honda' };
const HYUNDAI = { name: 'Hyundai', slug: 'hyundai' };
const TATA = { name: 'Tata', slug: 'tata' };
const MARUTI = { name: 'Maruti Suzuki', slug: 'maruti-suzuki' };

function model(
  make: { name: string; slug: string },
  name: string,
  slug: string,
  bodyType: string | null,
  isCurrent = true,
) {
  return { name, slug, make, variantCount: 3, isCurrent, bodyType };
}

/**
 * The seeded catalog has no specs, so no body types; the browse payload is
 * stubbed with one that has them. Its models are seeded ones, so their links
 * lead to real model pages.
 */
const BROWSE_PAGE = {
  segment: 'cars',
  makes: [
    { ...HONDA, modelCount: 3 },
    { ...HYUNDAI, modelCount: 3 },
    { ...MARUTI, modelCount: 2 },
    { ...TATA, modelCount: 2 },
  ],
  models: [
    model(HONDA, 'Amaze', 'amaze', 'Sedan'),
    model(HONDA, 'City', 'city', 'Sedan'),
    model(HONDA, 'Elevate', 'elevate', 'SUV'),
    model(HYUNDAI, 'Creta', 'creta', 'SUV'),
    model(HYUNDAI, 'Grand i10 Nios', 'grand-i10-nios', 'Hatchback'),
    model(HYUNDAI, 'Verna', 'verna', 'Sedan'),
    model(MARUTI, 'Baleno', 'baleno', 'Hatchback'),
    model(MARUTI, 'Swift', 'swift', 'Hatchback'),
    model(TATA, 'Nexon', 'nexon', 'SUV'),
    model(TATA, 'Safari', 'safari', 'SUV', false),
  ],
};

async function stubBrowsePage(page: Page) {
  await page.route('**/api/public-catalog/cars', (route) =>
    route.fulfill({ json: { success: true, data: BROWSE_PAGE } }),
  );
}

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/**
 * #389: body-type chips on `/cars`, each with its model count. One selected
 * lists its models and lives in the URL, so a reload or a shared link keeps it.
 */
for (const viewport of VIEWPORTS) {
  test(`body-type chips filter the car models and keep the choice in the URL, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await stubBrowsePage(page);
    await page.goto('/cars');

    const chips = page.getByRole('group', { name: 'Body type' });
    await expect(chips.getByRole('button')).toHaveText(['Hatchback 3', 'Sedan 3', 'SUV 4']);
    await expectNoSidewaysScroll(page, `chips at ${viewport.width}px`);

    await chips.getByRole('button', { name: 'SUV 4' }).click();
    await expect(page).toHaveURL(/\/cars\?body=suv$/);
    const suvs = page.getByRole('list', { name: 'SUVs' });
    // On sale first; the Safari here is no longer sold.
    await expect(suvs.getByRole('link')).toHaveText([
      /Honda Elevate/,
      /Hyundai Creta/,
      /Tata Nexon/,
      /Tata Safari.*No longer sold/,
    ]);
    await expectNoSidewaysScroll(page, `SUVs at ${viewport.width}px`);
    if (SHOTS)
      await page.screenshot({
        path: `${SHOTS}/catalog-body-type-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });

    // A reload keeps the choice, from the URL.
    await page.reload();
    await expect(chips.getByRole('button', { name: 'SUV 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(suvs.getByRole('link')).toHaveCount(4);

    // Another chip replaces it; a second tap on the selected one clears it.
    await chips.getByRole('button', { name: 'Sedan 3' }).click();
    await expect(page).toHaveURL(/\/cars\?body=sedan$/);
    await expect(page.getByRole('list', { name: 'Sedans' }).getByRole('link')).toHaveCount(3);
    await chips.getByRole('button', { name: 'Sedan 3' }).click();
    await expect(page).toHaveURL(/\/cars$/);
    await expect(page.getByRole('list', { name: 'Sedans' })).toHaveCount(0);

    // A model in the list leads to its page.
    await chips.getByRole('button', { name: 'Hatchback 3' }).click();
    await page
      .getByRole('list', { name: 'Hatchbacks' })
      .getByRole('link', { name: /Maruti Suzuki Swift/ })
      .click();
    await expect(page).toHaveURL(/\/cars\/maruti-suzuki\/swift$/);
  });
}

test('a body type the URL names but no chip offers is ignored', async ({ page }) => {
  await stubBrowsePage(page);
  await page.goto('/cars?body=coupe');

  await expect(page.getByRole('group', { name: 'Body type' })).toBeVisible();
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Makes' })).toBeVisible();
});

test('bikes have no body-type chips', async ({ page }) => {
  await page.goto('/bikes');
  await expect(page.getByRole('heading', { level: 1, name: 'Bikes in India' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Body type' })).toHaveCount(0);
});

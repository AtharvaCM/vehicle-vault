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

/**
 * #342: the landing page leads with the product. A hero with Home's Needs
 * attention list beside the headline and Create free account as the one
 * primary action, trust ticks, a catalog search with popular makes, then the
 * three features, the personas and a closing call to action.
 */
for (const viewport of VIEWPORTS) {
  test(`the landing page leads with the product and the catalog, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    // The hero: one headline, the preview, Create free account first.
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveText(
      'Every service, document and renewal for your vehicle, in one place.',
    );
    const preview = page.getByTestId('attention-preview');
    await expect(preview.getByRole('listitem')).toHaveCount(3);
    await expect(preview).toContainText('3 days late');
    const create = page.getByRole('main').getByRole('link', { name: 'Create free account' });
    await expect(create.first()).toHaveAttribute('href', '/register');
    await expect(create.first()).toBeInViewport();
    if (viewport.width >= 1024) {
      // Beside the headline, and all of it above the fold.
      const h1Box = (await h1.boundingBox())!;
      const previewBox = (await preview.boundingBox())!;
      expect(previewBox.x).toBeGreaterThan(h1Box.x + h1Box.width - 1);
      expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.getByRole('list', { name: 'Why Vehicle Vault' })).toHaveText(
      /Free.*Private documents.*Share with family/,
    );
    // Sign in lives in the header only.
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveCount(1);
    await expectNoSidewaysScroll(page, `landing at ${viewport.width}px`);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/landing-hero-${viewport.width}.png` });
    }

    // Three features with their captures, loaded and described.
    const features = page.getByTestId('landing-feature');
    await expect(features).toHaveCount(3);
    for (const image of await page.getByRole('main').locator('img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(780);
    }
    await expect(
      page.getByRole('heading', { name: 'Built for how you use your vehicle' }),
    ).toBeVisible();
    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/landing-${viewport.width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }

    // Browse cars & bikes goes to the search; a make found there opens its page.
    await page.getByRole('link', { name: 'Browse cars & bikes' }).click();
    await expect(page).toHaveURL(/#find-your-vehicle$/);
    const find = page.getByRole('region', { name: 'Find your vehicle' });
    await expect(find).toBeInViewport();
    await expect(find.getByRole('link', { name: 'All cars' })).toHaveAttribute('href', '/cars');
    // Popular makes the seeded catalog has.
    await expect(find.getByRole('link', { name: 'Maruti Suzuki' })).toHaveAttribute(
      'href',
      '/cars/maruti-suzuki',
    );
    await find.getByLabel('Search a make').fill('royal');
    await expect(
      find.getByRole('list', { name: 'Makes that match' }).getByRole('link'),
    ).toHaveCount(1);
    await expectNoSidewaysScroll(page, `landing search at ${viewport.width}px`);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/landing-search-${viewport.width}.png` });
    }
    await find
      .getByRole('link', { name: /Royal Enfield/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/bikes\/royal-enfield$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Royal Enfield');
  });
}

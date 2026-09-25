import { expect, test, type Page } from '@playwright/test';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const PAGES: Array<[string, string]> = [
  ['landing', '/'],
  ['sign-in', '/login'],
  ['register', '/register'],
  ['cars', '/cars'],
];

async function expectNoSidewaysScroll(page: Page, label: string) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflowing, label).toBe(false);
}

/**
 * #340: the landing page, the auth pages and the public catalog share one
 * frame: the plate logo home, the catalog, Sign in in the header only, and
 * one footer.
 */
for (const viewport of VIEWPORTS) {
  test(`landing, auth and catalog share one header and footer, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    for (const [name, path] of PAGES) {
      await page.goto(path);
      const site = page.getByRole('navigation', { name: 'Site' });
      await expect(page.getByRole('link', { name: 'Vehicle Vault home' }), name).toHaveAttribute(
        'href',
        '/',
      );
      await expect(site.getByRole('link'), name).toHaveCount(3);
      await expect(site.getByRole('link', { name: /cars$/i }), name).toHaveAttribute(
        'href',
        '/cars',
      );
      await expect(site.getByRole('link', { name: /bikes$/i }), name).toHaveAttribute(
        'href',
        '/bikes',
      );
      await expect(site.getByRole('link', { name: 'Sign in' }), name).toHaveAttribute(
        'href',
        '/login',
      );
      const footer = page.getByRole('navigation', { name: 'Footer' });
      await expect(footer.getByRole('link', { name: 'Cars' }), name).toBeVisible();
      await expect(footer.getByRole('link', { name: 'Bikes' }), name).toBeVisible();
      await expectNoSidewaysScroll(page, `${name} at ${viewport.width}px`);
      if (SHOTS)
        await page.screenshot({
          path: `${SHOTS}/frame-${name}-${viewport.width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }

    // The logo goes home, and the catalog links go where they say.
    await page.goto('/cars');
    await page.getByRole('link', { name: 'Vehicle Vault home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page
      .getByRole('navigation', { name: 'Site' })
      .getByRole('link', { name: /bikes$/i })
      .click();
    await expect(page).toHaveURL(/\/bikes$/);
  });
}

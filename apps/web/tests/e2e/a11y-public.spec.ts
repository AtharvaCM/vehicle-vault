import { expect, test, type Page } from '@playwright/test';

import { COLOUR_SCHEMES, expectAccessible } from './helpers/a11y';
import { registerAndSignIn } from './helpers/auth';
import { prisma } from './helpers/test-db';
import { selectDropdownOption, selectSearchableOption } from './helpers/vehicle-form';

/** Set to a directory to keep screenshots (PR evidence); unset in CI. */
const SHOTS = process.env.E2E_SCREENSHOT_DIR;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/** A seeded car variant's catalog addresses, found rather than hardcoded. */
async function catalogPaths() {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: {
      offerings: { some: {} },
      generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  const { model } = generation;
  const make = `/cars/${model.make.slug}`;
  return {
    make,
    model: `${make}/${model.slug}`,
    variant: `${make}/${model.slug}/${generation.slug}/${variant.slug}`,
  };
}

/** Goes to a page and waits for its heading, so axe sees the content, not a spinner. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/**
 * #353: the public face passes axe (WCAG 2.1 AA, serious and critical) at
 * phone and desktop widths, in light and dark: landing, auth, the catalog and
 * the first run of a new account.
 */
for (const viewport of VIEWPORTS) {
  for (const scheme of COLOUR_SCHEMES) {
    test(`the public face passes axe at ${viewport.width}px, ${scheme}`, async ({ page }) => {
      test.slow();
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      const catalog = await catalogPaths();

      for (const path of [
        '/',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password?token=not-a-real-token',
        '/cars',
        '/bikes',
        catalog.make,
        catalog.model,
        catalog.variant,
      ]) {
        await open(page, path);
        await expectAccessible(page, `${path} at ${viewport.width}px, ${scheme}`);
      }

      // The first run: Home and Garage with no vehicle, and the add-vehicle form.
      const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      await registerAndSignIn(page, {
        name: `Asha ${suffix}`,
        email: `e2e+a11y${suffix}@vehiclevault.dev`,
        password: 'VehicleVault!234',
      });
      for (const path of ['/home', '/garage', '/vehicles/new']) {
        await open(page, path);
        await expectAccessible(page, `${path} at ${viewport.width}px, ${scheme}`);
        if (SHOTS && path === '/home')
          await page.screenshot({
            path: `${SHOTS}/home-empty-${viewport.width}-${scheme}.png`,
            fullPage: true,
            animations: 'disabled',
          });
      }

      // Then the add-vehicle steps: saved at desktop width (the catalog pickers
      // want room), each step scanned at the width under test.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByLabel(/registration number/i).fill(`MH12AX${suffix.slice(-4)}`);
      await selectDropdownOption(page, /^vehicle type$/i, 'SUV');
      await page.getByLabel(/^year$/i).fill('2024');
      await page.getByLabel(/^year$/i).press('Tab');
      await selectSearchableOption(page, 'vehicle-make', 'Search makes...', 'Hyundai', 'Hyundai');
      await selectSearchableOption(page, 'vehicle-model', 'Search models...', 'Creta', 'Creta');
      await selectSearchableOption(page, 'vehicle-variant', 'Search variants...', 'SX', 'SX');
      await page.getByLabel('Odometer', { exact: true }).fill('15200');
      await page.getByRole('button', { name: /save vehicle/i }).click();
      await page.setViewportSize(viewport);
      await expect(page.getByText('Never miss a renewal')).toBeVisible();
      await expectAccessible(page, `papers step at ${viewport.width}px, ${scheme}`);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await expect(page.getByText('Suggested service schedule')).toBeVisible();
      await expectAccessible(page, `schedule step at ${viewport.width}px, ${scheme}`);
    });
  }
}

/** Every control on the page gets a visible focus ring when tabbed to. */
async function expectFocusVisibleOnTab(page: Page, label: string, stops = 12) {
  for (let index = 0; index < stops; index += 1) {
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return { name: 'body', visible: true };
      const style = getComputedStyle(element);
      const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const ringed = style.boxShadow !== 'none' && style.boxShadow !== '';
      return {
        name: `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)}"`,
        visible: outlined || ringed,
      };
    });
    expect(ring.visible, `${label}: no focus ring on ${ring.name}`).toBe(true);
  }
}

test('keyboard: every stop on the landing and sign-in pages shows a focus ring', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, '/');
  await expectFocusVisibleOnTab(page, 'landing');
  await open(page, '/login');
  await expectFocusVisibleOnTab(page, 'sign in');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

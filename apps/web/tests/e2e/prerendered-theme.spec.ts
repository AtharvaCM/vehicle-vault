import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/**
 * The theme on a prerendered catalog page: set by index.html's inline script
 * before the page paints, with the hydration of #root untouched. Runs against
 * a prerendered build served statically, like the other prerendered specs, so
 * it skips unless `E2E_PRERENDERED` is set.
 */
test.skip(!process.env.E2E_PRERENDERED, 'needs a prerendered build served statically');

const HYDRATION_ERROR = /hydrat|did not match|#418|#423|#425/i;

async function variantPath() {
  const variant = await prisma.vehicleCatalogVariant.findFirstOrThrow({
    where: { generation: { model: { make: { vehicleType: 'car', marketCode: 'IN' } } } },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'asc' },
  });
  const { generation } = variant;
  return `/cars/${generation.model.make.slug}/${generation.model.slug}/${generation.slug}/${variant.slug}`;
}

/** The theme on <html> as the parser finished, before any module script runs. */
async function rememberThemeAtParse(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        const state = window as unknown as { __themeAtParse: boolean; __h1AtParse: Element | null };
        state.__themeAtParse = document.documentElement.classList.contains('dark');
        state.__h1AtParse = document.querySelector('h1');
      }
    });
  });
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.describe('theme on a prerendered page', () => {
  let path: string;

  test.beforeAll(async () => {
    path = await variantPath();
  });

  for (const [label, colorScheme, stored, dark] of [
    ['a dark system', 'dark', null, true],
    ['a light system with Dark chosen', 'light', 'dark', true],
    ['a dark system with Light chosen', 'dark', 'light', false],
  ] as const) {
    test(`with ${label}, the theme is right before hydration and hydration still holds`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme });
      if (stored) {
        await page.addInitScript(
          (value) => window.localStorage.setItem('vehicle-vault.theme', value),
          stored,
        );
      }
      await rememberThemeAtParse(page);

      await page.goto(path);
      await expect
        .poll(() =>
          page.evaluate(() =>
            Object.keys(document.querySelector('h1') ?? {}).some((key) =>
              key.startsWith('__react'),
            ),
          ),
        )
        .toBe(true);

      const state = await page.evaluate(() => {
        const w = window as unknown as { __themeAtParse: boolean; __h1AtParse: Element | null };
        return {
          atParse: w.__themeAtParse,
          now: document.documentElement.classList.contains('dark'),
          sameH1: w.__h1AtParse === document.querySelector('h1'),
        };
      });
      expect(state).toEqual({ atParse: dark, now: dark, sameH1: true });
      expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);
    });
  }
});

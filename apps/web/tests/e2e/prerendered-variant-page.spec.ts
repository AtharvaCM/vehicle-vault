import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/**
 * Runs against a prerendered build served as static files, the way Vercel
 * serves it: `build:prerendered` pointed at a local API, then `vite preview`.
 * The ordinary e2e run serves the dev server, which has no prerendered pages,
 * so it skips this file unless `E2E_PRERENDERED` is set.
 */
test.skip(!process.env.E2E_PRERENDERED, 'needs a prerendered build served statically');

type SeededVariant = { path: string; heading: string };

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
    path: `/cars/${make.slug}/${model.slug}/${generation.slug}/${variant.slug}`,
    heading: `${make.name} ${model.name} ${variant.name}`,
  };
}

const HYDRATION_ERROR = /hydrat|did not match|#418|#423|#425/i;

/** Every console error and uncaught exception the page raises. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * Keeps hold of the prerendered `<h1>` as the parser left it, before any
 * module script runs, so the test can tell hydration (which keeps the node)
 * from a fresh client render (which replaces it).
 */
async function rememberPrerenderedHeading(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        (window as unknown as { __prerenderedH1: Element | null }).__prerenderedH1 =
          document.querySelector('h1');
      }
    });
  });
}

function isReactOwned(page: Page) {
  return page.evaluate(() => {
    const kept = (window as unknown as { __prerenderedH1: Element | null }).__prerenderedH1;
    const current = document.querySelector('h1');
    return {
      sameNode: Boolean(kept) && kept === current,
      hydrated: Boolean(current && Object.keys(current).some((key) => key.startsWith('__react'))),
    };
  });
}

test.describe('prerendered variant page', () => {
  let variant: SeededVariant;

  test.beforeAll(async () => {
    variant = await seededCarVariant();
  });

  test('the raw HTML already carries the heading, schedule, head tags and noindex', async ({
    request,
  }) => {
    const response = await request.get(variant.path);
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain(`>${variant.heading}</h1>`);
    expect(html).toContain('Typical schedule for a petrol car');
    expect(html).toContain('Periodic Service');
    expect(html).toContain('Engine Oil');
    expect(html).toContain(
      `<title>${variant.heading} — service schedule and specs | Vehicle Vault</title>`,
    );
    expect(html).toContain(
      `<link rel="canonical" href="https://vehicle-vault.middle-earth.in${variant.path}" />`,
    );
    expect(html).toContain(`<meta property="og:title" content="${variant.heading}`);
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  test('with JavaScript off the schedule is still there', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    await page.goto(variant.path);

    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Typical schedule for a petrol car' }),
    ).toBeVisible();
    await context.close();
  });

  test('hydrates in place with no mismatch, then works as the app', async ({ page }) => {
    const errors = collectErrors(page);
    const catalogRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/public-catalog/')) catalogRequests.push(request.url());
    });
    await rememberPrerenderedHeading(page);

    await page.goto(variant.path);
    await expect.poll(async () => (await isReactOwned(page)).hydrated).toBe(true);

    // Hydration kept the server's node rather than rendering a new one.
    expect(await isReactOwned(page)).toEqual({ sameNode: true, hydrated: true });
    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    // The page read its data from the HTML, not from the API.
    expect(catalogRequests).toEqual([]);
    expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);

    // A hydrated link is the router's: the navigation stays in the page.
    await page.evaluate(() => {
      (window as unknown as { __samePage: boolean }).__samePage = true;
    });
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __samePage?: boolean }).__samePage),
    ).toBe(true);
    // Leaving the catalog puts the app's own head back.
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://vehicle-vault.middle-earth.in${variant.path}`,
    );
    expect(errors).toEqual([]);
  });

  test('the calculator is live after hydration, with saved inputs and no mismatch', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const storageKey = `vehicle-vault.running-cost:${variant.path.slice(1)}`;
    // Inputs saved on an earlier visit: read after hydration, never during it.
    await page.addInitScript((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ kmPerMonth: '1500', efficiency: '20', energyPrice: '100' }),
      );
    }, storageKey);
    await rememberPrerenderedHeading(page);

    await page.goto(variant.path);
    await expect.poll(async () => (await isReactOwned(page)).hydrated).toBe(true);
    expect(await isReactOwned(page)).toEqual({ sameNode: true, hydrated: true });

    const calculator = page.getByRole('region', { name: 'Running cost' });
    await expect(calculator.getByLabel('Distance per month')).toHaveValue('1500');
    const monthlyFuel = calculator
      .getByRole('region', { name: 'Per month' })
      .getByRole('definition')
      .first();
    // 1,500 km ÷ 20 km/L × ₹100.
    await expect(monthlyFuel).toHaveText('₹7,500');

    await calculator.getByLabel('Distance per month').fill('3000');
    await expect(monthlyFuel).toHaveText('₹15,000');
    expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);
  });

  test('a returning signed-in visitor gets a clean client render, not a mismatch', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const user = {
      id: 'someone',
      email: 'someone@example.test',
      name: 'Someone',
      role: 'user',
      emailVerified: true,
    };
    // The session below is made up, so answer the check for it here.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { success: true, data: user } }),
    );
    // A stored session whose refresh token has not expired: the auth provider
    // opens on "Loading account", which the signed-out markup cannot match.
    await page.addInitScript((storedUser) => {
      const base64url = (value: object) =>
        btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const token = `${base64url({ alg: 'HS256' })}.${base64url({
        sub: 'someone',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })}.signature`;
      window.localStorage.setItem(
        'vehicle-vault.auth-session',
        JSON.stringify({
          accessToken: token,
          refreshToken: token,
          user: storedUser,
        }),
      );
    }, user);

    await page.goto(variant.path);

    await expect(page.getByRole('heading', { level: 1, name: variant.heading })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open your garage' })).toBeVisible();
    expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);
  });

  test('app routes still come through the SPA fallback', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

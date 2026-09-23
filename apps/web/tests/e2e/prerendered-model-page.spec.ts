import { expect, test, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/**
 * A model page as Vercel serves it: `build:prerendered` pointed at a local
 * API, then `vite preview`. Skipped in the ordinary dev-server run, like the
 * other prerendered specs, unless `E2E_PRERENDERED` is set.
 */
test.skip(!process.env.E2E_PRERENDERED, 'needs a prerendered build served statically');

const CANONICAL_ORIGIN = (
  process.env.VITE_CANONICAL_ORIGIN || 'https://vehicle-vault.middle-earth.in'
).replace(/\/+$/, '');

const HYDRATION_ERROR = /hydrat|did not match|#418|#423|#425/i;

type SeededModel = { path: string; heading: string; firstVariant: string };

async function seededCarModel(): Promise<SeededModel> {
  const model = await prisma.vehicleCatalogModel.findFirstOrThrow({
    where: {
      make: { vehicleType: 'car', marketCode: 'IN' },
      generations: { some: { isCurrent: true, variants: { some: { offerings: { some: {} } } } } },
    },
    include: {
      make: true,
      generations: { where: { isCurrent: true }, include: { variants: true } },
    },
    orderBy: { slug: 'asc' },
  });
  const variants = (model.generations as { variants: { name: string }[] }[])
    .flatMap((generation) => generation.variants.map((variant) => variant.name))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }));

  return {
    path: `/cars/${model.make.slug}/${model.slug}`,
    heading: `${model.make.name} ${model.name}`,
    firstVariant: variants[0] ?? '',
  };
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Keeps the parser's `<h1>`, so hydration (same node) can be told from a fresh render. */
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

test.describe('prerendered model page', () => {
  let model: SeededModel;

  test.beforeAll(async () => {
    model = await seededCarModel();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('the raw HTML carries the heading, the variant links, head tags and JSON-LD', async ({
    request,
  }) => {
    const response = await request.get(model.path);
    expect(response.status()).toBe(200);
    const html = await response.text();

    expect(html).toContain(`>${model.heading}</h1>`);
    expect(html).toMatch(new RegExp(`<a[^>]*href="${model.path}/[^"/]+/[^"/]+"`));
    expect(html).toContain('Periodic Service');
    expect(html).toContain(
      `<title>${model.heading} — variants, service schedule and specs | Vehicle Vault</title>`,
    );
    expect(html).toContain(`<link rel="canonical" href="${CANONICAL_ORIGIN}${model.path}" />`);
    // The guest's Track this vehicle link, with the model page as its intent.
    const track = html.match(/<a[^>]*href="\/register\?catalog=([^"]+)"[^>]*>Track this vehicle/);
    expect(decodeURIComponent(track?.[1] ?? '')).toBe(model.path);
    const scripts = [
      ...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g),
    ];
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0]?.[1] ?? 'null')).toMatchObject({
      '@type': 'Car',
      name: model.heading,
      url: `${CANONICAL_ORIGIN}${model.path}`,
    });
  });

  test('hydrates in place with no mismatch, and its links stay in the app', async ({ page }) => {
    const errors = collectErrors(page);
    const catalogRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/public-catalog/')) catalogRequests.push(request.url());
    });
    await rememberPrerenderedHeading(page);

    await page.goto(model.path);
    await expect.poll(async () => (await isReactOwned(page)).hydrated).toBe(true);
    expect(await isReactOwned(page)).toEqual({ sameNode: true, hydrated: true });
    expect(catalogRequests).toEqual([]);
    expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);

    await page.evaluate(() => {
      (window as unknown as { __samePage: boolean }).__samePage = true;
    });
    await page
      .getByRole('link', { name: new RegExp(`^${model.heading} ${model.firstVariant}`) })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: `${model.heading} ${model.firstVariant}` }),
    ).toBeVisible();
    await page.getByRole('link', { name: `All ${model.heading} variants` }).click();
    await expect(page.getByRole('heading', { level: 1, name: model.heading })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${CANONICAL_ORIGIN}${model.path}`,
    );
    expect(
      await page.evaluate(() => (window as unknown as { __samePage?: boolean }).__samePage),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
});

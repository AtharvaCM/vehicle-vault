import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { prisma } from './helpers/test-db';

/**
 * Make and browse pages as Vercel serves them: `build:prerendered` pointed at
 * a local API, then `vite preview`. Skipped in the ordinary dev-server run,
 * like the other prerendered specs, unless `E2E_PRERENDERED` is set.
 */
test.skip(!process.env.E2E_PRERENDERED, 'needs a prerendered build served statically');

const CANONICAL_ORIGIN = (
  process.env.VITE_CANONICAL_ORIGIN || 'https://vehicle-vault.middle-earth.in'
).replace(/\/+$/, '');

const HYDRATION_ERROR = /hydrat|did not match|#418|#423|#425/i;

type SeededMake = {
  path: string;
  name: string;
  /** Model page paths across every make row with this slug. */
  modelPaths: string[];
  /** A model under the make's second row, and one of its variants. */
  model: { path: string; name: string };
  variant: { path: string; name: string };
};

/** The seed's make with car pages from more than one make row (Hyundai: car and SUV). */
async function seededMergedMake(): Promise<SeededMake> {
  const rows = (await prisma.vehicleCatalogMake.findMany({
    where: { marketCode: 'IN', vehicleType: { in: ['car', 'suv', 'van'] } },
    include: {
      models: {
        where: { generations: { some: { variants: { some: { offerings: { some: {} } } } } } },
        include: { generations: { include: { variants: { orderBy: { slug: 'asc' } } } } },
        orderBy: { slug: 'asc' },
      },
    },
    orderBy: [{ slug: 'asc' }, { vehicleType: 'asc' }],
  })) as {
    slug: string;
    name: string;
    models: {
      name: string;
      slug: string;
      generations: { slug: string; variants: { name: string; slug: string }[] }[];
    }[];
  }[];
  const bySlug = new Map<string, typeof rows>();
  for (const row of rows) {
    if (row.models.length > 0) bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row]);
  }
  const merged = [...bySlug.values()].find((makeRows) => makeRows.length > 1);
  if (!merged) throw new Error('The seed has no make with more than one public make row.');

  const [first, second] = merged as [(typeof rows)[number], (typeof rows)[number]];
  const path = `/cars/${first.slug}`;
  const model = second.models[0]!;
  const generation = model.generations.find((entry) => entry.variants.length > 0)!;
  const variant = generation.variants[0]!;
  return {
    path,
    name: first.name,
    modelPaths: merged.flatMap((row) => row.models.map((entry) => `${path}/${entry.slug}`)),
    model: { path: `${path}/${model.slug}`, name: model.name },
    variant: {
      path: `${path}/${model.slug}/${generation.slug}/${variant.slug}`,
      name: variant.name,
    },
  };
}

type JsonLdNode = Record<string, unknown>;

async function fetchHtml(request: APIRequestContext, pagePath: string) {
  const response = await request.get(pagePath);
  expect(response.status(), pagePath).toBe(200);
  return response.text();
}

/** The page's one JSON-LD document, parsed, and its nodes. */
function jsonLdOf(html: string) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts[0]?.[1] ?? 'null') as JsonLdNode;
  expect(data['@context']).toBe('https://schema.org');
  const nodes = Array.isArray(data['@graph']) ? (data['@graph'] as JsonLdNode[]) : [data];
  return { data, nodes };
}

/**
 * A valid `BreadcrumbList`: `ListItem`s numbered from 1, each with a name and
 * an absolute URL on the canonical origin, ending on the page's own canonical.
 */
function expectBreadcrumbList(html: string, pagePath: string, names: string[]) {
  const list = jsonLdOf(html).nodes.find((node) => node['@type'] === 'BreadcrumbList');
  expect(list, `${pagePath} has a BreadcrumbList`).toBeDefined();
  const items = list?.itemListElement as {
    '@type': string;
    position: number;
    name: string;
    item: string;
  }[];
  expect(items.map((item) => item['@type'])).toEqual(names.map(() => 'ListItem'));
  expect(items.map((item) => item.position)).toEqual(names.map((_, index) => index + 1));
  expect(items.map((item) => item.name)).toEqual(names);
  for (const item of items) {
    expect(item.item.startsWith(`${CANONICAL_ORIGIN}/`), item.item).toBe(true);
  }
  expect(items.at(-1)?.item).toBe(`${CANONICAL_ORIGIN}${pagePath}`);
  expect(items[0]?.item).toBe(`${CANONICAL_ORIGIN}/cars`);
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

test.describe('prerendered make and browse pages', () => {
  let make: SeededMake;

  test.beforeAll(async () => {
    make = await seededMergedMake();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('the raw HTML of /cars already lists the makes, with its head tags', async ({ request }) => {
    const html = await fetchHtml(request, '/cars');

    expect(html).toMatch(/<h1[^>]*>Cars in India<\/h1>/);
    expect(html.match(new RegExp(`<a[^>]*href="${make.path}"`, 'g'))).toHaveLength(1);
    expect(html).toContain(
      '<title>Cars by make — models, service schedules and specs | Vehicle Vault</title>',
    );
    expect(html).toContain(`<link rel="canonical" href="${CANONICAL_ORIGIN}/cars" />`);
    expect(html).toContain(`<meta property="og:url" content="${CANONICAL_ORIGIN}/cars" />`);
    expect(jsonLdOf(html).data).toMatchObject({ '@type': 'ItemList', name: 'Cars by make' });

    const bikes = await fetchHtml(request, '/bikes');
    expect(bikes).toMatch(/<h1[^>]*>Bikes in India<\/h1>/);
    expect(bikes).toMatch(/<a[^>]*href="\/bikes\/[^"/]+"/);
  });

  test('the raw HTML of a make page lists the models of all its make rows', async ({ request }) => {
    const html = await fetchHtml(request, make.path);

    expect(html).toContain(`>${make.name} cars</h1>`);
    for (const modelPath of make.modelPaths) {
      expect(html, modelPath).toMatch(new RegExp(`<a[^>]*href="${modelPath}"`));
    }
    expect(html).toContain(
      `<title>${make.name} cars — models, service schedules and specs | Vehicle Vault</title>`,
    );
    expect(html).toContain(`<link rel="canonical" href="${CANONICAL_ORIGIN}${make.path}" />`);
    const itemList = jsonLdOf(html).nodes.find((node) => node['@type'] === 'ItemList');
    expect((itemList?.itemListElement as { url: string }[]).map((item) => item.url).sort()).toEqual(
      make.modelPaths.map((modelPath) => `${CANONICAL_ORIGIN}${modelPath}`).sort(),
    );
  });

  test('make, model and variant pages carry a valid BreadcrumbList', async ({ request }) => {
    expectBreadcrumbList(await fetchHtml(request, make.path), make.path, ['Cars', make.name]);
    expectBreadcrumbList(await fetchHtml(request, make.model.path), make.model.path, [
      'Cars',
      make.name,
      make.model.name,
    ]);
    expectBreadcrumbList(await fetchHtml(request, make.variant.path), make.variant.path, [
      'Cars',
      make.name,
      make.model.name,
      make.variant.name,
    ]);
  });

  test('/cars hydrates in place with no mismatch, and its links stay in the app', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const catalogRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/public-catalog/')) catalogRequests.push(request.url());
    });
    await rememberPrerenderedHeading(page);

    await page.goto('/cars');
    await expect.poll(async () => (await isReactOwned(page)).hydrated).toBe(true);
    expect(await isReactOwned(page)).toEqual({ sameNode: true, hydrated: true });
    expect(catalogRequests).toEqual([]);
    expect(errors.filter((error) => HYDRATION_ERROR.test(error))).toEqual([]);

    await page.evaluate(() => {
      (window as unknown as { __samePage: boolean }).__samePage = true;
    });
    await page
      .getByRole('region', { name: 'Makes' })
      .getByRole('link', { name: new RegExp(`^${make.name}`) })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: `${make.name} cars` })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${CANONICAL_ORIGIN}${make.path}`,
    );
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Cars', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cars in India' })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __samePage?: boolean }).__samePage),
    ).toBe(true);
    expect(errors).toEqual([]);
  });

  test('a make page hydrates in place with no mismatch', async ({ page }) => {
    const errors = collectErrors(page);
    await rememberPrerenderedHeading(page);

    await page.goto(make.path);
    await expect.poll(async () => (await isReactOwned(page)).hydrated).toBe(true);
    expect(await isReactOwned(page)).toEqual({ sameNode: true, hydrated: true });
    expect(errors).toEqual([]);
  });
});

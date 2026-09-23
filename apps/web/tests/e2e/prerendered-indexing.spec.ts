import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { resolveApiProxyTarget } from './helpers/api-target';
import { prisma } from './helpers/test-db';

/**
 * The indexing flag, the page-quality gate, the sitemap and robots.txt, end to
 * end: a prerendered build served statically, as Vercel serves it.
 *
 * It needs `build:prerendered` run with `VITE_PUBLIC_CATALOG_INDEXING=on` and
 * `PRERENDER_API_BASE_URL` at the local API, then `vite preview`. The catalog
 * seed has no spec rows, so this spec writes some (a few variants that clear
 * the gate and some that don't) and runs the prerender step again over the
 * same build, the way a deploy after an import run would.
 */
test.skip(!process.env.E2E_PRERENDERED, 'needs a prerendered build served statically');

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CANONICAL_ORIGIN = (
  process.env.VITE_CANONICAL_ORIGIN || 'https://vehicle-vault.middle-earth.in'
).replace(/\/+$/, '');

type Variant = { id: string; path: string; name: string };

/** Enough public facts to clear the gate: engine, claimed mileage and more than ten fields. */
const RICH_CAR_SPEC = {
  engineCc: 1498,
  engineCyl: 4,
  engineType: '1.5L i-VTEC',
  powerPs: 121,
  powerRpm: 6600,
  torqueNm: 145,
  torqueRpm: 4300,
  transmission: 'Manual',
  mileageCombined: 17.8,
  fuelCapLitres: 40,
  seatingCapacity: 5,
  tyreSize: '185/55 R16',
};

const RICH_BIKE_SPEC = {
  engineCc: 349,
  engineCyl: 1,
  powerPs: 20.2,
  torqueNm: 27,
  mileageCombined: 35,
  fuelCapLitres: 13,
  kerbWeightKg: 195,
  seatHeightMm: 805,
  gearCount: 5,
  brakeFrontType: 'Disc',
};

/** Thin: engine and mileage, but too few facts in all. */
const THIN_CAR_SPEC = { engineCc: 1197, powerPs: 83, mileageCombined: 20.3 };

/** Seeded India variants of a type, from the end of the alphabet (other specs take the start). */
async function variants(vehicleType: 'car' | 'motorcycle', count: number): Promise<Variant[]> {
  const rows = await prisma.vehicleCatalogVariant.findMany({
    where: {
      offerings: { some: { fuelTypes: { has: 'petrol' } } },
      generation: { model: { make: { vehicleType, marketCode: 'IN' } } },
    },
    include: { generation: { include: { model: { include: { make: true } } } } },
    orderBy: { slug: 'desc' },
    take: count,
  });
  expect(rows, `the seed has ${count} ${vehicleType} variants`).toHaveLength(count);

  return rows.map(
    (row: {
      id: string;
      name: string;
      slug: string;
      generation: {
        slug: string;
        model: { name: string; slug: string; make: { name: string; slug: string } };
      };
    }) => {
      const { generation } = row;
      const { model } = generation;
      const segment = vehicleType === 'car' ? 'cars' : 'bikes';
      return {
        id: row.id,
        path: `/${segment}/${model.make.slug}/${model.slug}/${generation.slug}/${row.slug}`,
        name: `${model.make.name} ${model.name} ${row.name}`,
      };
    },
  );
}

type IndexEntry = {
  segment: string;
  make: { slug: string };
  model: { slug: string };
  generation: { slug: string };
  variant: { slug: string };
  indexable: boolean;
  updatedAt: string;
};

const entryPath = (entry: IndexEntry) =>
  `/${entry.segment}/${entry.make.slug}/${entry.model.slug}/${entry.generation.slug}/${entry.variant.slug}`;

const modelPathOf = (entry: IndexEntry) =>
  `/${entry.segment}/${entry.make.slug}/${entry.model.slug}`;

/**
 * Every model page and the gate's verdict on it: indexable when any of its
 * variants is, each variant address counted once (the first index row wins).
 */
function modelVerdicts(index: IndexEntry[]) {
  const seen = new Set<string>();
  const verdicts = new Map<string, boolean>();
  for (const entry of index) {
    if (seen.has(entryPath(entry))) continue;
    seen.add(entryPath(entry));
    const modelPath = modelPathOf(entry);
    verdicts.set(modelPath, (verdicts.get(modelPath) ?? false) || entry.indexable);
  }
  return verdicts;
}

/**
 * Every make page and the gate's verdict on it: indexable when any variant
 * under it is, across its make rows (Hyundai's car and SUV rows share a slug).
 */
function makeVerdicts(index: IndexEntry[]) {
  const seen = new Set<string>();
  const verdicts = new Map<string, boolean>();
  for (const entry of index) {
    if (seen.has(entryPath(entry))) continue;
    seen.add(entryPath(entry));
    const makePath = `/${entry.segment}/${entry.make.slug}`;
    verdicts.set(makePath, (verdicts.get(makePath) ?? false) || entry.indexable);
  }
  return verdicts;
}

/** The browse pages: one per segment the index has anything in, always indexed. */
function browsePaths(index: IndexEntry[]) {
  return [...new Set(index.map((entry) => `/${entry.segment}`))];
}

type JsonLdNode = Record<string, unknown>;

/** The page's `Car` or `Motorcycle` node, out of its JSON-LD graph. */
function vehicleNode(data: JsonLdNode) {
  const nodes = Array.isArray(data['@graph']) ? (data['@graph'] as JsonLdNode[]) : [data];
  return nodes.find((node) => node['@type'] === 'Car' || node['@type'] === 'Motorcycle');
}

function robotsOf(html: string) {
  return html.match(/<meta name="robots" content="([^"]*)" \/>/)?.[1];
}

function structuredData(html: string) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts[0]?.[1] ?? 'null') as JsonLdNode;
  expect(data['@context']).toBe('https://schema.org');
  return vehicleNode(data);
}

async function fetchHtml(request: APIRequestContext, pagePath: string) {
  const response = await request.get(pagePath);
  expect(response.status(), pagePath).toBe(200);
  return response.text();
}

test.describe('prerendered indexing', () => {
  let rich: Variant;
  let thin: Variant;
  let bare: Variant;
  let bike: Variant;
  let index: IndexEntry[];
  let prerenderLog: string;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    [rich, thin, bare] = (await variants('car', 3)) as [Variant, Variant, Variant];
    [bike] = (await variants('motorcycle', 1)) as [Variant];

    await prisma.vehicleCatalogVariantSpec.deleteMany({
      where: { variantId: { in: [rich.id, thin.id, bare.id, bike.id] } },
    });
    await prisma.vehicleCatalogVariantSpec.createMany({
      data: [
        { variantId: rich.id, ...RICH_CAR_SPEC },
        { variantId: thin.id, ...THIN_CAR_SPEC },
        { variantId: bike.id, ...RICH_BIKE_SPEC },
      ],
    });

    // Prerender again over the build, now that the catalog has specs.
    const apiBaseUrl = `${resolveApiProxyTarget(process.env).replace(/\/+$/, '')}/api`;
    const { stdout } = await promisify(execFile)('node', ['dist-ssr/cli.js'], {
      cwd: webRoot,
      env: { ...process.env, NODE_ENV: 'production', PRERENDER_API_BASE_URL: apiBaseUrl },
    });
    prerenderLog = stdout;

    const response = await fetch(`${apiBaseUrl}/public-catalog/index`);
    index = ((await response.json()) as { data: { variants: IndexEntry[] } }).data.variants;
  });

  test.afterAll(async () => {
    await prisma.vehicleCatalogVariantSpec.deleteMany({
      where: { variantId: { in: [rich, thin, bare, bike].filter(Boolean).map((v) => v.id) } },
    });
  });

  test('the build ran with indexing on and printed the indexable count', () => {
    expect(
      prerenderLog,
      'run build:prerendered with VITE_PUBLIC_CATALOG_INDEXING=on for this spec',
    ).toContain('Indexing is on');
    const models = modelVerdicts(index);
    const indexableModels = [...models.values()].filter(Boolean).length;
    const makes = makeVerdicts(index);
    const indexableMakes = [...makes.values()].filter(Boolean).length;
    const browse = browsePaths(index).length;
    const indexable = new Set(index.filter((entry) => entry.indexable).map(entryPath));
    const pages = new Set(index.map(entryPath));
    expect(prerenderLog).toContain(
      `Indexable: ${indexable.size + indexableModels + indexableMakes + browse} of ${
        pages.size + models.size + makes.size + browse
      } pages.`,
    );
    expect(prerenderLog).toContain(
      `(${pages.size} variant pages, ${models.size} model pages, ${makes.size} make pages, ` +
        `${browse} browse pages)`,
    );
  });

  test('a model page is indexable exactly when one of its variants is', async ({ request }) => {
    const models = modelVerdicts(index);
    const richModel = modelPathOf(index.find((entry) => entryPath(entry) === rich.path)!);
    expect(models.get(richModel)).toBe(true);

    for (const [modelPath, indexable] of models) {
      const html = await fetchHtml(request, modelPath);
      expect(robotsOf(html), modelPath).toBe(indexable ? 'index, follow' : 'noindex');
    }
  });

  test('a make page is indexable exactly when a variant under it is; browse pages always are', async ({
    request,
  }) => {
    const makes = makeVerdicts(index);
    const richMake = rich.path.split('/').slice(0, 3).join('/');
    expect(makes.get(richMake)).toBe(true);

    for (const [makePath, indexable] of makes) {
      const html = await fetchHtml(request, makePath);
      expect(robotsOf(html), makePath).toBe(indexable ? 'index, follow' : 'noindex');
    }
    for (const browsePath of browsePaths(index)) {
      expect(robotsOf(await fetchHtml(request, browsePath)), browsePath).toBe('index, follow');
    }
  });

  test('the gate passes the rich variants and rejects the thin and bare ones', () => {
    const verdict = (variant: Variant) =>
      index.find((entry) => entryPath(entry) === variant.path)?.indexable;

    expect(verdict(rich)).toBe(true);
    expect(verdict(bike)).toBe(true);
    expect(verdict(thin)).toBe(false);
    expect(verdict(bare)).toBe(false);
  });

  test('the sitemap lists exactly the indexable pages, with their lastmod', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const xml = await response.text();

    const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const indexableModels = [...modelVerdicts(index)]
      .filter(([, indexable]) => indexable)
      .map(([modelPath]) => modelPath);
    const indexableMakes = [...makeVerdicts(index)]
      .filter(([, indexable]) => indexable)
      .map(([makePath]) => makePath);
    const expected = [
      ...new Set(index.filter((entry) => entry.indexable).map(entryPath)),
      ...indexableModels,
      ...indexableMakes,
      ...browsePaths(index),
    ].map((pagePath) => `${CANONICAL_ORIGIN}${pagePath}`);
    expect(listed.sort()).toEqual(expected.sort());
    expect(listed).toContain(`${CANONICAL_ORIGIN}${rich.path}`);
    expect(listed).not.toContain(`${CANONICAL_ORIGIN}${thin.path}`);
    expect(listed).not.toContain(`${CANONICAL_ORIGIN}${bare.path}`);

    const richEntry = index.find((entry) => entryPath(entry) === rich.path);
    const lastmod = new Date(richEntry?.updatedAt ?? '').toISOString().replace(/\.\d{3}Z$/, 'Z');
    expect(xml).toContain(
      `<loc>${CANONICAL_ORIGIN}${rich.path}</loc>\n    <lastmod>${lastmod}</lastmod>`,
    );
  });

  test('robots.txt allows everything and points at the sitemap on the canonical origin', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    expect(await response.text()).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`,
    );
  });

  test('noindex is on exactly the pages the gate rejects, across the whole catalog', async ({
    request,
  }) => {
    const verdicts = new Map(index.map((entry) => [entryPath(entry), entry.indexable]));

    for (const [pagePath, indexable] of verdicts) {
      const html = await fetchHtml(request, pagePath);
      expect(robotsOf(html), pagePath).toBe(indexable ? 'index, follow' : 'noindex');
    }
  });

  test('pages carry parseable JSON-LD of the right type, with engine and mileage', async ({
    request,
  }) => {
    const car = structuredData(await fetchHtml(request, rich.path));
    expect(car).toMatchObject({
      '@type': 'Car',
      name: rich.name,
      url: `${CANONICAL_ORIGIN}${rich.path}`,
      vehicleEngine: {
        '@type': 'EngineSpecification',
        engineDisplacement: { value: 1498, unitCode: 'CMQ' },
      },
      fuelEfficiency: { '@type': 'QuantitativeValue', value: 17.8, unitText: 'km/L' },
    });

    expect(structuredData(await fetchHtml(request, bike.path))).toMatchObject({
      '@type': 'Motorcycle',
      name: bike.name,
      fuelEfficiency: { value: 35 },
    });

    // A page with no specs still says what it is.
    expect(structuredData(await fetchHtml(request, bare.path))).toMatchObject({
      '@type': 'Car',
      name: bare.name,
    });
  });

  test('the hydrated app keeps the static robots tag and JSON-LD, not a second copy', async ({
    page,
  }) => {
    await page.goto(rich.path);
    // Hydrated: React owns the heading, so the client's head hook has run.
    await page.waitForFunction(() => {
      const heading = document.querySelector('h1');
      return Boolean(heading && Object.keys(heading).some((key) => key.startsWith('__react')));
    });

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? 'null',
    );
    expect(vehicleNode(data)).toMatchObject({ '@type': 'Car', name: rich.name });

    // An SPA navigation to a gated page swaps both in place.
    await page.evaluate(() => {
      (window as unknown as { __samePage: boolean }).__samePage = true;
    });
    await page.evaluate((to) => {
      window.history.pushState({}, '', to);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, thin.path);
    await expect(page.getByRole('heading', { level: 1, name: thin.name })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { __samePage?: boolean }).__samePage),
    ).toBe(true);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect
      .poll(async () =>
        vehicleNode(
          JSON.parse(
            (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
          ),
        ),
      )
      .toMatchObject({ name: thin.name });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });
});

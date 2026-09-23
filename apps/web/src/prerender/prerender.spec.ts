// @vitest-environment node
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogIndexEntry,
  type PublicCatalogModelPage,
  type PublicCatalogSpec,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRERENDER_STATE_ELEMENT_ID } from './prerendered-state';
import { prerenderPublicCatalog, PrerenderError, type PrerenderFetch } from './prerender';

const API = 'https://api.example.test/api';
const ORIGIN = 'https://catalog.example.test';

function carPage(): PublicCatalogVariantPage {
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Hyundai', slug: 'hyundai' },
    model: { name: 'i20', slug: 'i20' },
    generation: {
      name: 'i20 lineup',
      slug: 'i20-lineup',
      yearStart: 2020,
      yearEnd: null,
      isCurrent: true,
    },
    variant: { name: 'Asta', slug: 'asta' },
    offerings: [{ fuelTypes: [FuelType.Petrol], yearStart: 2023, yearEnd: null, isCurrent: true }],
    specs: null,
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      items: [
        { category: MaintenanceCategory.PeriodicService, km: 10000, months: 12, source: 'default' },
        { category: MaintenanceCategory.TimingBelt, km: 60000, months: null, source: 'default' },
      ],
    },
    calculatorSeed: {
      fuelType: FuelType.Petrol,
      claimedMileage: null,
      claimedRangeKm: null,
      batteryKwh: null,
    },
    indexable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
  };
}

function bikePage(): PublicCatalogVariantPage {
  return {
    ...carPage(),
    segment: 'bikes',
    vehicleType: VehicleType.Motorcycle,
    make: { name: 'Royal Enfield', slug: 'royal-enfield' },
    model: { name: 'Classic 350', slug: 'classic-350' },
    generation: { ...carPage().generation, name: 'Classic lineup', slug: 'classic-lineup' },
    variant: { name: 'Chrome & Red', slug: 'chrome-and-red' },
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Motorcycle,
      items: [
        { category: MaintenanceCategory.ChainService, km: 1000, months: 1, source: 'default' },
      ],
    },
    // The one page the page-quality gate passes.
    specs: { engineCc: 349, powerPs: 20.2, mileageCombined: 35 } as PublicCatalogSpec,
    indexable: true,
    updatedAt: '2026-08-01T12:34:56.789Z',
  };
}

function indexEntry(page: PublicCatalogVariantPage): PublicCatalogIndexEntry {
  return {
    segment: page.segment,
    vehicleType: page.vehicleType,
    make: page.make,
    model: page.model,
    generation: { name: page.generation.name, slug: page.generation.slug },
    variant: page.variant,
    indexable: page.indexable,
    updatedAt: page.updatedAt,
  };
}

type FakeResponse = { status: number; body?: unknown; headers?: Record<string, string> };

function respond({ status, body, headers = {} }: FakeResponse) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  };
}

const ok = (data: unknown) => respond({ status: 200, body: { success: true, data } });

/** A fetch that answers from fixtures by path, and records what it was asked for. */
function fixtureFetch(
  routes: Record<string, () => ReturnType<typeof respond> | Promise<never>>,
): PrerenderFetch & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = async (url: string) => {
    calls.push(url);
    const { pathname, search } = new URL(url);
    const route = routes[`${pathname.replace(/^\/api/, '')}${search}`];
    if (!route) return respond({ status: 404 });
    return route();
  };
  return Object.assign(fetcher, { calls });
}

/** The model page the API would build over these variants, all of one model, the first representative. */
function modelPageOf(variants: PublicCatalogVariantPage[]): PublicCatalogModelPage {
  const [first] = variants;
  if (!first) throw new Error('A model page needs a variant.');
  return {
    segment: first.segment,
    vehicleType: first.vehicleType,
    make: first.make,
    model: first.model,
    generations: [
      {
        ...first.generation,
        variants: variants.map((page) => ({
          ...page.variant,
          fuelTypes: page.offerings[0]?.fuelTypes ?? [],
          yearStart: page.offerings[0]?.yearStart ?? null,
          yearEnd: page.offerings[0]?.yearEnd ?? null,
          isCurrent: page.offerings[0]?.isCurrent ?? false,
          transmission: page.specs?.transmission ?? null,
        })),
      },
    ],
    representative: {
      generation: { name: first.generation.name, slug: first.generation.slug },
      variant: first.variant,
      specs: first.specs,
    },
    schedule: first.schedule,
    indexable: variants.some((page) => page.indexable),
    updatedAt: first.updatedAt,
  };
}

const MODEL_PAGES = '/public-catalog/model-pages?page=1&pageSize=100';

function modelPagesBody(models: PublicCatalogModelPage[]) {
  return { items: models, page: 1, pageSize: 100, total: models.length, hasMore: false };
}

const pages = [carPage(), bikePage()];
const catalogRoutes = {
  '/public-catalog/index': () => ok({ variants: pages.map(indexEntry) }),
  '/public-catalog/variant-pages?page=1&pageSize=200': () =>
    ok({ items: pages, page: 1, pageSize: 200, total: 2, hasMore: false }),
  [MODEL_PAGES]: () => ok(modelPagesBody([modelPageOf([carPage()]), modelPageOf([bikePage()])])),
};

describe('prerenderPublicCatalog', () => {
  let distDir: string;
  const log = vi.fn();
  const sleep = vi.fn(async () => undefined);

  beforeEach(async () => {
    distDir = await mkdtemp(path.join(tmpdir(), 'vv-prerender-'));
    // The real template, with the app's default head tags the pages replace.
    const template = await readFile(path.resolve(__dirname, '../../index.html'), 'utf8');
    await writeFile(path.join(distDir, 'index.html'), template);
  });

  afterEach(async () => {
    await rm(distDir, { recursive: true, force: true });
  });

  const run = (fetcher: PrerenderFetch, options: { indexing?: boolean } = {}) =>
    prerenderPublicCatalog({
      apiBaseUrl: API,
      distDir,
      fetch: fetcher,
      origin: ORIGIN,
      log,
      sleep,
      ...options,
    });

  const exists = (file: string) =>
    access(path.join(distDir, file)).then(
      () => true,
      () => false,
    );

  /** The page's JSON-LD, parsed. Fails the test when it is missing or not JSON. */
  const structuredData = (html: string) => {
    const scripts = [
      ...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/g),
    ];
    expect(scripts).toHaveLength(1);
    return JSON.parse(scripts[0]?.[1] ?? 'null') as Record<string, unknown>;
  };

  const robotsOf = (html: string) => html.match(/<meta name="robots" content="([^"]*)" \/>/)?.[1];

  const readPage = (pagePath: string) =>
    readFile(path.join(distDir, ...pagePath.split('/').filter(Boolean), 'index.html'), 'utf8');

  it('writes an index.html for every variant and model in the index, and says how many', async () => {
    const summary = await run(fixtureFetch(catalogRoutes));

    expect(summary.paths).toEqual([
      '/cars/hyundai/i20/i20-lineup/asta',
      '/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red',
      '/cars/hyundai/i20',
      '/bikes/royal-enfield/classic-350',
    ]);
    expect(summary).toMatchObject({ variantPages: 2, modelPages: 2 });
    for (const pagePath of summary.paths) {
      await expect(readPage(pagePath)).resolves.toContain('<html');
    }
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^Prerendered 4 pages \(2 variant pages, 2 model pages\)/),
    );
  });

  it('reads the catalog in three requests, not one per page', async () => {
    const fetcher = fixtureFetch(catalogRoutes);

    await run(fetcher);

    expect(fetcher.calls).toEqual([
      `${API}/public-catalog/index`,
      `${API}/public-catalog/variant-pages?page=1&pageSize=200`,
      `${API}${MODEL_PAGES}`,
    ]);
  });

  it('puts the heading and the schedule in the static markup', async () => {
    await run(fixtureFetch(catalogRoutes));
    const html = await readPage('/cars/hyundai/i20/i20-lineup/asta');
    const root = html.slice(html.indexOf('<div id="root">'));

    expect(root).toMatch(/<h1[^>]*>Hyundai i20 Asta<\/h1>/);
    expect(root).toContain('Typical schedule for a petrol car');
    expect(root).toContain('Periodic Service');
    expect(root).toContain('Every 10,000 km or 12 months, whichever comes first');
    expect(root).toContain('Timing Belt');
    // The finished page, not a lazy route's loading fallback.
    expect(root).not.toContain('Loading the specs and service schedule');

    const bike = await readPage('/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red');
    expect(bike).toContain('Chain Service');
  });

  it('gives each page its own title, description, absolute canonical and preview tags', async () => {
    await run(fixtureFetch(catalogRoutes));
    const html = await readPage('/cars/hyundai/i20/i20-lineup/asta');
    const head = html.slice(0, html.indexOf('</head>'));
    const canonical = `${ORIGIN}/cars/hyundai/i20/i20-lineup/asta`;
    const title = 'Hyundai i20 Asta — service schedule and specs | Vehicle Vault';

    expect(head.match(/<title>/g)).toHaveLength(1);
    expect(head).toContain(`<title>${title}</title>`);
    expect(head).toContain(`<link rel="canonical" href="${canonical}" />`);
    expect(head).toContain(`<meta property="og:url" content="${canonical}" />`);
    expect(head).toContain(`<meta property="og:title" content="${title}" />`);
    expect(head).toContain(`<meta name="twitter:title" content="${title}" />`);
    expect(head).toContain(
      `<meta property="og:image" content="${ORIGIN}/web-app-manifest-512x512.png" />`,
    );
    expect(head).toMatch(
      /<meta name="description" content="Service schedule and specs for the Hyundai i20 Asta \(2023 – present · Petrol\)\. Typical schedule for a petrol car: a periodic service every 10,000 km or 12 months, whichever comes first\." \/>/,
    );
    // One of each: the app's own description and preview tags are replaced, not doubled.
    expect(head.match(/name="description"/g)).toHaveLength(1);
    expect(head.match(/property="og:title"/g)).toHaveLength(1);
    expect(head).not.toContain('One record of your car or two-wheeler');
  });

  describe('with indexing off, the default', () => {
    it('marks every page noindex, even one the page-quality gate passes', async () => {
      const summary = await run(fixtureFetch(catalogRoutes));

      for (const pagePath of summary.paths) {
        expect(robotsOf(await readPage(pagePath))).toBe('noindex');
      }
      expect(summary).toMatchObject({ indexablePages: 0, sitemap: false });
    });

    it('writes no sitemap, and removes one a previous build left', async () => {
      await writeFile(path.join(distDir, 'sitemap.xml'), '<urlset>stale</urlset>');

      await run(fixtureFetch(catalogRoutes));

      expect(await exists('sitemap.xml')).toBe(false);
    });

    it('writes a robots.txt that allows everything and names no sitemap', async () => {
      await run(fixtureFetch(catalogRoutes));

      expect(await readFile(path.join(distDir, 'robots.txt'), 'utf8')).toBe(
        'User-agent: *\nAllow: /\n',
      );
    });

    it('prints the indexable count, and how many the gate would pass', async () => {
      await run(fixtureFetch(catalogRoutes));

      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(
          /^Indexable: 0 of 4 pages\. Indexing is off .*; 2 pass the page-quality gate\.$/,
        ),
      );
    });
  });

  describe('with indexing on', () => {
    const bikePath = '/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red';
    const carPath = '/cars/hyundai/i20/i20-lineup/asta';

    it('puts noindex exactly on the pages the gate rejects', async () => {
      const summary = await run(fixtureFetch(catalogRoutes), { indexing: true });

      expect(robotsOf(await readPage(carPath))).toBe('noindex');
      expect(robotsOf(await readPage(bikePath))).toBe('index, follow');
      // A model page follows its variants: indexable when any of them is.
      expect(robotsOf(await readPage('/cars/hyundai/i20'))).toBe('noindex');
      expect(robotsOf(await readPage('/bikes/royal-enfield/classic-350'))).toBe('index, follow');
      expect(summary).toMatchObject({ indexablePages: 2, sitemap: true });
    });

    it('lists exactly the indexable pages in the sitemap, absolute, with lastmod', async () => {
      await run(fixtureFetch(catalogRoutes), { indexing: true });
      const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');

      expect(sitemap).toBe(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          '  <url>\n' +
          `    <loc>${ORIGIN}/bikes/royal-enfield/classic-350</loc>\n` +
          '    <lastmod>2026-08-01T12:34:56Z</lastmod>\n' +
          '  </url>\n' +
          '  <url>\n' +
          `    <loc>${ORIGIN}${bikePath}</loc>\n` +
          '    <lastmod>2026-08-01T12:34:56Z</lastmod>\n' +
          '  </url>\n' +
          '</urlset>\n',
      );
      expect(sitemap).not.toContain(carPath);
      expect(sitemap).not.toContain('/cars/hyundai/i20<');
    });

    it('points robots.txt at the sitemap on the canonical origin', async () => {
      await run(fixtureFetch(catalogRoutes), { indexing: true });

      expect(await readFile(path.join(distDir, 'robots.txt'), 'utf8')).toBe(
        `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
      );
    });

    it('still writes a sitemap when no page passes the gate', async () => {
      const thin = { ...bikePage(), indexable: false };
      const fetcher = fixtureFetch({
        '/public-catalog/index': () => ok({ variants: [indexEntry(thin)] }),
        '/public-catalog/variant-pages?page=1&pageSize=200': () =>
          ok({ items: [thin], page: 1, pageSize: 200, total: 1, hasMore: false }),
        [MODEL_PAGES]: () => ok(modelPagesBody([modelPageOf([thin])])),
      });

      await run(fetcher, { indexing: true });

      const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
      expect(sitemap).not.toContain('<url>');
      expect(sitemap).toContain('</urlset>');
    });

    it('prints the indexable count', async () => {
      await run(fixtureFetch(catalogRoutes), { indexing: true });

      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(/^Indexable: 2 of 4 pages\. Indexing is on/),
      );
    });
  });

  it('fails with indexing on when the API sends no gate verdict, and not with it off', async () => {
    const withoutVerdict = (page: PublicCatalogVariantPage) => {
      const { indexable: _dropped, ...rest } = page;
      return rest;
    };
    const oldApi = {
      '/public-catalog/index': () =>
        ok({
          variants: pages.map((page) => {
            const { indexable: _dropped, ...rest } = indexEntry(page);
            return rest;
          }),
        }),
      '/public-catalog/variant-pages?page=1&pageSize=200': () =>
        ok({
          items: pages.map(withoutVerdict),
          page: 1,
          pageSize: 200,
          total: 2,
          hasMore: false,
        }),
      [MODEL_PAGES]: () =>
        ok(
          modelPagesBody(
            pages.map((page) => {
              const { indexable: _dropped, ...rest } = modelPageOf([page]);
              return rest as PublicCatalogModelPage;
            }),
          ),
        ),
    };

    await expect(run(fixtureFetch(oldApi), { indexing: true })).rejects.toThrow(
      /no page-quality verdict/,
    );
    await expect(run(fixtureFetch(oldApi))).resolves.toMatchObject({ indexablePages: 0 });
  });

  it('fails when the index and a page payload disagree on the gate', async () => {
    const fetcher = fixtureFetch({
      ...catalogRoutes,
      '/public-catalog/index': () =>
        ok({ variants: pages.map((page) => ({ ...indexEntry(page), indexable: true })) }),
    });

    await expect(run(fetcher, { indexing: true })).rejects.toThrow(/disagree/);
  });

  it('gives every page parseable JSON-LD of the right schema.org type', async () => {
    await run(fixtureFetch(catalogRoutes));

    const car = structuredData(await readPage('/cars/hyundai/i20/i20-lineup/asta'));
    expect(car).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Car',
      name: 'Hyundai i20 Asta',
      url: `${ORIGIN}/cars/hyundai/i20/i20-lineup/asta`,
    });

    const bikeHtml = await readPage(
      '/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red',
    );
    // In the head, where a crawler reading the static HTML finds it.
    expect(bikeHtml.indexOf('application/ld+json')).toBeLessThan(bikeHtml.indexOf('</head>'));
    expect(structuredData(bikeHtml)).toMatchObject({
      '@type': 'Motorcycle',
      name: 'Royal Enfield Classic 350 Chrome & Red',
      vehicleEngine: {
        '@type': 'EngineSpecification',
        engineDisplacement: { value: 349, unitCode: 'CMQ' },
      },
      fuelEfficiency: { '@type': 'QuantitativeValue', value: 35, unitText: 'km/L' },
    });
  });

  it('escapes catalog names in the head', async () => {
    await run(fixtureFetch(catalogRoutes));
    const html = await readPage('/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red');

    expect(html).toContain('<title>Royal Enfield Classic 350 Chrome &amp; Red');
  });

  it('embeds the data the browser hydrates from', async () => {
    await run(fixtureFetch(catalogRoutes));
    const html = await readPage('/cars/hyundai/i20/i20-lineup/asta');

    const state = html.match(
      new RegExp(
        `<script type="application/json" id="${PRERENDER_STATE_ELEMENT_ID}">(.*?)</script>`,
      ),
    );
    expect(state).not.toBeNull();
    const [query, ...others] = JSON.parse(state?.[1] ?? '{}').queries as {
      queryKey: unknown[];
      state: { data: unknown };
    }[];
    expect(others).toHaveLength(0);
    expect(query?.queryKey).toEqual([
      'publicCatalog',
      'variant',
      'cars',
      'hyundai',
      'i20',
      'i20-lineup',
      'asta',
    ]);
    expect(query?.state.data).toEqual(carPage());
    expect(html).toMatch(/<script class="\$tsr">[^<]*self\.\$_TSR=\{[^<]*\$_TSR\.router=/);
  });

  it('waits out a rate limit for as long as the API asks', async () => {
    let limited = true;
    const fetcher = fixtureFetch({
      ...catalogRoutes,
      '/public-catalog/index': () => {
        if (limited) {
          limited = false;
          return respond({ status: 429, headers: { 'Retry-After': '3' } });
        }
        return catalogRoutes['/public-catalog/index']();
      },
    });

    await run(fetcher);

    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it('fails when the API cannot be reached', async () => {
    const fetcher = fixtureFetch({
      '/public-catalog/index': () => Promise.reject(new TypeError('fetch failed')),
    });

    await expect(run(fetcher)).rejects.toThrow(
      new PrerenderError(
        `Could not reach the catalog API at ${API}/public-catalog/index: fetch failed`,
      ),
    );
  });

  it('fails when the API answers with an error', async () => {
    const fetcher = fixtureFetch({ '/public-catalog/index': () => respond({ status: 503 }) });

    await expect(run(fetcher)).rejects.toThrow(/answered 503/);
  });

  it('fails on an empty index rather than shipping no catalog', async () => {
    const fetcher = fixtureFetch({ '/public-catalog/index': () => ok({ variants: [] }) });

    await expect(run(fetcher)).rejects.toThrow(/is empty/);
  });

  it('fails when a variant in the index has no page payload', async () => {
    const fetcher = fixtureFetch({
      ...catalogRoutes,
      '/public-catalog/variant-pages?page=1&pageSize=200': () =>
        ok({ items: [carPage()], page: 1, pageSize: 200, total: 1, hasMore: false }),
    });

    await expect(run(fetcher)).rejects.toThrow(/did not include it/);
  });

  it('refuses a slug that could write outside its directory', async () => {
    const escaping = { ...carPage(), variant: { name: 'Odd', slug: '..' } };
    const fetcher = fixtureFetch({
      '/public-catalog/index': () => ok({ variants: [indexEntry(escaping)] }),
      '/public-catalog/variant-pages?page=1&pageSize=200': () =>
        ok({ items: [escaping], page: 1, pageSize: 200, total: 1, hasMore: false }),
    });

    await expect(run(fetcher)).rejects.toThrow(/unsafe slug/);
  });

  describe('model pages', () => {
    const modelPath = '/cars/hyundai/i20';

    it('puts the heading, the variants by generation and the schedule in the static markup', async () => {
      await run(fixtureFetch(catalogRoutes));
      const html = await readPage(modelPath);
      const root = html.slice(html.indexOf('<div id="root">'));

      expect(root).toMatch(/<h1[^>]*>Hyundai i20<\/h1>/);
      expect(root).toMatch(/<h3[^>]*>i20 lineup<\/h3>/);
      expect(root).toContain('href="/cars/hyundai/i20/i20-lineup/asta"');
      expect(root).toContain('Typical schedule for a petrol car');
      expect(root).toContain('Shown for the Hyundai i20 Asta');
      expect(root).toContain(`catalog=${encodeURIComponent(modelPath)}`);
      expect(root).not.toContain('Loading the variants and service schedule');
    });

    it('gives a model page its own title, absolute canonical, preview tags and JSON-LD', async () => {
      await run(fixtureFetch(catalogRoutes));
      const html = await readPage(modelPath);
      const head = html.slice(0, html.indexOf('</head>'));
      const title = 'Hyundai i20 — variants, service schedule and specs | Vehicle Vault';

      expect(head).toContain(`<title>${title}</title>`);
      expect(head).toContain(`<link rel="canonical" href="${ORIGIN}${modelPath}" />`);
      expect(head).toContain(`<meta property="og:url" content="${ORIGIN}${modelPath}" />`);
      expect(head).toContain(`<meta property="og:title" content="${title}" />`);
      expect(head).toContain(
        '<meta name="description" content="All 1 variant of the Hyundai i20 (2020 – present · Petrol), by generation',
      );
      expect(head.match(/name="description"/g)).toHaveLength(1);
      expect(structuredData(html)).toEqual({
        '@context': 'https://schema.org',
        '@type': 'Car',
        name: 'Hyundai i20',
        url: `${ORIGIN}${modelPath}`,
        brand: { '@type': 'Brand', name: 'Hyundai' },
        model: 'i20',
        fuelType: 'Petrol',
        vehicleModelDate: '2020',
      });
      expect(structuredData(await readPage('/bikes/royal-enfield/classic-350'))).toMatchObject({
        '@type': 'Motorcycle',
        name: 'Royal Enfield Classic 350',
      });
    });

    it('embeds the model page data the browser hydrates from', async () => {
      await run(fixtureFetch(catalogRoutes));
      const html = await readPage(modelPath);

      const state = html.match(
        new RegExp(
          `<script type="application/json" id="${PRERENDER_STATE_ELEMENT_ID}">(.*?)</script>`,
        ),
      );
      const [query, ...others] = JSON.parse(state?.[1] ?? '{}').queries as {
        queryKey: unknown[];
        state: { data: unknown };
      }[];
      expect(others).toHaveLength(0);
      expect(query?.queryKey).toEqual(['publicCatalog', 'model', 'cars', 'hyundai', 'i20']);
      expect(query?.state.data).toEqual(modelPageOf([carPage()]));
    });

    it('writes one page for a model under two make rows, dated by its newest variant', async () => {
      const asta = carPage();
      const sportz: PublicCatalogVariantPage = {
        ...carPage(),
        vehicleType: VehicleType.SUV,
        variant: { name: 'Sportz', slug: 'sportz' },
        specs: { engineCc: 1197 } as PublicCatalogSpec,
        indexable: true,
        updatedAt: '2026-09-01T00:00:00.000Z',
      };
      // The same address again from the SUV make row: the first index row wins,
      // so its later date and verdict count for nothing.
      const astaAgain = {
        ...indexEntry(asta),
        vehicleType: VehicleType.SUV,
        indexable: true,
        updatedAt: '2026-12-01T00:00:00.000Z',
      };
      const fetcher = fixtureFetch({
        '/public-catalog/index': () =>
          ok({ variants: [indexEntry(asta), indexEntry(sportz), astaAgain] }),
        '/public-catalog/variant-pages?page=1&pageSize=200': () =>
          ok({ items: [asta, sportz], page: 1, pageSize: 200, total: 2, hasMore: false }),
        [MODEL_PAGES]: () => ok(modelPagesBody([modelPageOf([asta, sportz])])),
      });

      const summary = await run(fetcher, { indexing: true });

      expect(summary.paths.filter((pagePath) => pagePath === modelPath)).toHaveLength(1);
      expect(summary).toMatchObject({ variantPages: 2, modelPages: 1 });
      expect(robotsOf(await readPage(modelPath))).toBe('index, follow');
      const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
      expect(sitemap).toContain(
        `<loc>${ORIGIN}${modelPath}</loc>\n    <lastmod>2026-09-01T00:00:00Z</lastmod>`,
      );
    });

    it('fails when the index lists a model the model pages do not include', async () => {
      const fetcher = fixtureFetch({
        ...catalogRoutes,
        [MODEL_PAGES]: () => ok(modelPagesBody([modelPageOf([carPage()])])),
      });

      await expect(run(fetcher)).rejects.toThrow(
        /lists variants of \/bikes\/royal-enfield\/classic-350 but the model pages did not include it/,
      );
    });

    it('fails when a model page and its variants disagree on the gate', async () => {
      const fetcher = fixtureFetch({
        ...catalogRoutes,
        [MODEL_PAGES]: () => ok(modelPagesBody([{ ...modelPageOf([carPage()]), indexable: true }])),
      });

      await expect(run(fetcher)).rejects.toThrow(/\/cars\/hyundai\/i20 and its variants disagree/);
    });
  });
});

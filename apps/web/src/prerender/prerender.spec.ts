// @vitest-environment node
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogIndexEntry,
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

const pages = [carPage(), bikePage()];
const catalogRoutes = {
  '/public-catalog/index': () => ok({ variants: pages.map(indexEntry) }),
  '/public-catalog/variant-pages?page=1&pageSize=200': () =>
    ok({ items: pages, page: 1, pageSize: 200, total: 2, hasMore: false }),
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

  it('writes an index.html for every variant in the index, and says how many', async () => {
    const summary = await run(fixtureFetch(catalogRoutes));

    expect(summary.paths).toEqual([
      '/cars/hyundai/i20/i20-lineup/asta',
      '/bikes/royal-enfield/classic-350/classic-lineup/chrome-and-red',
    ]);
    for (const pagePath of summary.paths) {
      await expect(readPage(pagePath)).resolves.toContain('<html');
    }
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^Prerendered 2 pages \(2 variant pages\)/),
    );
  });

  it('reads the catalog in two requests, not one per page', async () => {
    const fetcher = fixtureFetch(catalogRoutes);

    await run(fetcher);

    expect(fetcher.calls).toEqual([
      `${API}/public-catalog/index`,
      `${API}/public-catalog/variant-pages?page=1&pageSize=200`,
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
          /^Indexable: 0 of 2 pages\. Indexing is off .*; 1 pass the page-quality gate\.$/,
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
      expect(summary).toMatchObject({ indexablePages: 1, sitemap: true });
    });

    it('lists exactly the indexable pages in the sitemap, absolute, with lastmod', async () => {
      await run(fixtureFetch(catalogRoutes), { indexing: true });
      const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');

      expect(sitemap).toBe(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          '  <url>\n' +
          `    <loc>${ORIGIN}${bikePath}</loc>\n` +
          '    <lastmod>2026-08-01T12:34:56Z</lastmod>\n' +
          '  </url>\n' +
          '</urlset>\n',
      );
      expect(sitemap).not.toContain(carPath);
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
      });

      await run(fetcher, { indexing: true });

      const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
      expect(sitemap).not.toContain('<url>');
      expect(sitemap).toContain('</urlset>');
    });

    it('prints the indexable count', async () => {
      await run(fixtureFetch(catalogRoutes), { indexing: true });

      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(/^Indexable: 1 of 2 pages\. Indexing is on/),
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
});

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  PublicCatalogIndex,
  PublicCatalogIndexEntry,
  PublicCatalogModelPage,
  PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import {
  PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX,
  PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX,
} from '@vehicle-vault/shared';

import {
  CANONICAL_ORIGIN,
  modelPageHead,
  publicModelPath,
  publicVariantPath,
  renderHeadTags,
  variantPageHead,
  type PublicPageHead,
} from '@/features/public-catalog/head/public-page-head';
import { isPageIndexed, PUBLIC_CATALOG_INDEXING } from '@/features/public-catalog/head/indexing';
import { queryKeys } from '@/lib/query/query-keys';

import { composeDocument } from './compose-document';
import { renderAppAtUrl, type RenderedApp, type SeededQuery } from './render-app';
import { newestUpdatedAt, renderRobots, renderSitemap } from './sitemap';

/** The slice of `fetch` the prerender uses, so a test can hand it fixtures. */
export type PrerenderFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'json'>>;

export type PrerenderOptions = {
  /** The API base, e.g. `https://api.example.test/api`. */
  apiBaseUrl: string;
  /** The finished client build: `index.html` is the template, pages land beside it. */
  distDir: string;
  fetch?: PrerenderFetch;
  /** The canonical origin for head tags, the sitemap and `robots.txt`. */
  origin?: string;
  /**
   * The global indexing flag. Off: every page is `noindex` and no sitemap is
   * written. Defaults to the build's `VITE_PUBLIC_CATALOG_INDEXING`, the value
   * the client bundle was built with too.
   */
  indexing?: boolean;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  render?: (url: string, queries: SeededQuery[]) => Promise<RenderedApp>;
};

export type PrerenderSummary = {
  /** Site paths written, e.g. `/cars/honda/city/city-lineup/vx`. */
  paths: string[];
  variantPages: number;
  modelPages: number;
  /** Pages without `noindex`: the flag is on and the gate passed them. The sitemap lists exactly these. */
  indexablePages: number;
  /** Whether `sitemap.xml` was written. It is when indexing is on, even if it lists nothing. */
  sitemap: boolean;
};

export class PrerenderError extends Error {
  override name = 'PrerenderError';
}

/**
 * A page the prerender writes: where it lives, the queries its route reads,
 * and its head. Variant and model pages are jobs; make and browse pages (#177)
 * become jobs the same way, with their own payloads and heads.
 */
type PageJob = {
  path: string;
  queries: SeededQuery[];
  head: PublicPageHead;
  /** The API's page-quality gate passed it. */
  passesGate: boolean;
  /** Indexed (no `noindex`), and so in the sitemap: the flag is on and the gate passed it. */
  indexed: boolean;
  /** The newest `updatedAt` in the page's subtree, for the sitemap's `lastmod`. */
  lastmod: string;
};

const MAX_ATTEMPTS_UNREACHABLE = 3;
const MAX_RATE_LIMITED_WAITS = 5;
const MAX_RETRY_AFTER_MS = 60_000;
/** A slug straight from the catalog's `slug` columns: nothing that could leave its directory. */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Writes a static `index.html` for every publishable catalog variant, and for
 * every model with one, into the client build, so the page's content and link
 * preview exist before any
 * JavaScript runs. Fails — and so fails the deploy — when the catalog API
 * cannot be read or has nothing in it, rather than shipping an empty catalog.
 */
export async function prerenderPublicCatalog(options: PrerenderOptions): Promise<PrerenderSummary> {
  const startedAt = Date.now();
  const {
    distDir,
    fetch: fetcher = globalThis.fetch as PrerenderFetch,
    origin = CANONICAL_ORIGIN,
    indexing = PUBLIC_CATALOG_INDEXING,
    log = (line) => console.log(line),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    render = renderAppAtUrl,
  } = options;
  const apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, '');
  const getData = <T>(url: string) => fetchApiData<T>(url, { fetcher, log, sleep });

  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

  const index = await getData<PublicCatalogIndex>(`${apiBaseUrl}/public-catalog/index`);
  if (!Array.isArray(index?.variants) || index.variants.length === 0) {
    throw new PrerenderError(
      `The catalog index at ${apiBaseUrl} is empty. Refusing to build a site with no catalog pages.`,
    );
  }
  log(`Catalog index: ${index.variants.length} variants.`);

  const payloads = await fetchAllVariantPages(apiBaseUrl, index.variants.length, getData);
  // Variant jobs first: they refuse an unsafe slug before any path is built from one.
  const variantPageJobs = variantJobs(index.variants, payloads, { origin, indexing });
  const modelPayloads = await fetchAllModelPages(
    apiBaseUrl,
    variantsByModelAddress(index.variants).size,
    getData,
  );
  const modelPageJobs = modelJobs(index.variants, modelPayloads, { origin, indexing });
  const jobs = [...variantPageJobs, ...modelPageJobs];

  let written = 0;
  for (const job of jobs) {
    const rendered = await render(job.path, job.queries).catch((error: unknown) => {
      throw new PrerenderError(
        `Could not render ${job.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    const html = composeDocument(template, {
      headTags: renderHeadTags(job.head),
      appHtml: rendered.appHtml,
      routerScript: rendered.routerScript,
      queryState: rendered.queryState,
    });
    const file = path.join(distDir, ...job.path.split('/').filter(Boolean), 'index.html');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
    written += 1;
  }

  const indexed = jobs.filter((job) => job.indexed);
  const base = origin.replace(/\/+$/, '');
  const sitemapFile = path.join(distDir, 'sitemap.xml');
  if (indexing) {
    await writeFile(
      sitemapFile,
      renderSitemap(
        indexed.map((job) => ({ path: job.path, lastmod: job.lastmod })),
        base,
      ),
      'utf8',
    );
  } else {
    // Nothing to list, so no file: a crawler asking gets a 404, not an empty promise.
    await rm(sitemapFile, { force: true });
  }
  await writeFile(
    path.join(distDir, 'robots.txt'),
    renderRobots({ sitemapUrl: indexing ? `${base}/sitemap.xml` : null }),
    'utf8',
  );

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const passing = jobs.filter((job) => job.passesGate).length;
  log(
    `Prerendered ${written} pages (${variantPageJobs.length} variant pages, ` +
      `${modelPageJobs.length} model pages) into ${distDir} in ${seconds}s.`,
  );
  log(
    indexing
      ? `Indexable: ${indexed.length} of ${written} pages. Indexing is on: sitemap.xml lists ` +
          `those ${indexed.length}, and the other ${written - indexed.length} are noindex.`
      : `Indexable: 0 of ${written} pages. Indexing is off (VITE_PUBLIC_CATALOG_INDEXING is not "on"), ` +
          `so every page is noindex and there is no sitemap.xml; ${passing} pass the page-quality gate.`,
  );

  return {
    paths: jobs.map((job) => job.path),
    variantPages: variantPageJobs.length,
    modelPages: modelPageJobs.length,
    indexablePages: indexed.length,
    sitemap: indexing,
  };
}

async function fetchAllVariantPages(
  apiBaseUrl: string,
  expected: number,
  getData: <T>(url: string) => Promise<T>,
): Promise<PublicCatalogVariantPage[]> {
  return fetchAllBatches<PublicCatalogVariantPage>({
    label: 'variant pages',
    url: `${apiBaseUrl}/public-catalog/variant-pages`,
    pageSize: PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX,
    expected,
    getData,
  });
}

async function fetchAllModelPages(
  apiBaseUrl: string,
  expected: number,
  getData: <T>(url: string) => Promise<T>,
): Promise<PublicCatalogModelPage[]> {
  return fetchAllBatches<PublicCatalogModelPage>({
    label: 'model pages',
    url: `${apiBaseUrl}/public-catalog/model-pages`,
    pageSize: PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX,
    expected,
    getData,
  });
}

async function fetchAllBatches<T>({
  label,
  url,
  pageSize,
  expected,
  getData,
}: {
  label: string;
  url: string;
  pageSize: number;
  expected: number;
  getData: <D>(url: string) => Promise<D>;
}): Promise<T[]> {
  // A few pages of slack for rows published between the index and the batches;
  // past that something is wrong, and looping on would never end.
  const maxPages = Math.ceil(expected / pageSize) + 5;
  const items: T[] = [];

  for (let page = 1; ; page += 1) {
    if (page > maxPages) {
      throw new PrerenderError(`The ${label} did not end after ${maxPages} batches.`);
    }
    const batch = await getData<{ items?: T[]; hasMore?: boolean }>(
      `${url}?page=${page}&pageSize=${pageSize}`,
    );
    if (!Array.isArray(batch?.items)) {
      throw new PrerenderError(`Batch ${page} of the ${label} had no items.`);
    }
    items.push(...batch.items);
    if (!batch.hasMore) break;
  }

  return items;
}

function variantJobs(
  entries: PublicCatalogIndexEntry[],
  payloads: PublicCatalogVariantPage[],
  { origin, indexing }: { origin: string; indexing: boolean },
): PageJob[] {
  const payloadsByPath = new Map(payloads.map((payload) => [publicVariantPath(payload), payload]));
  const jobs = new Map<string, PageJob>();

  for (const entry of entries) {
    const segments = [
      entry.segment,
      entry.make.slug,
      entry.model.slug,
      entry.generation.slug,
      entry.variant.slug,
    ];
    const unsafe = segments.find((segment) => !SAFE_SEGMENT.test(segment));
    if (unsafe !== undefined) {
      throw new PrerenderError(`Refusing to write a page for the unsafe slug "${unsafe}".`);
    }

    const pagePath = publicVariantPath(entry);
    const payload = payloadsByPath.get(pagePath);
    if (!payload) {
      throw new PrerenderError(
        `The index lists ${pagePath} but the variant pages did not include it. ` +
          'The catalog may have changed mid-build; run the build again.',
      );
    }
    // Two index rows can share an address: Hyundai is both a car and an SUV
    // make with one slug. An address is one file, written once.
    if (jobs.has(pagePath)) continue;
    // An API older than the gate sends no verdict. With indexing on, that
    // would quietly ship every page noindex and an empty sitemap.
    if (indexing && typeof payload.indexable !== 'boolean') {
      throw new PrerenderError(
        `Indexing is on, but the catalog API gave ${pagePath} no page-quality verdict. ` +
          'Deploy the API with the page-quality gate first.',
      );
    }
    // The index and the page come from one gate on the API. Disagreeing, the
    // sitemap and the page's own robots tag could contradict each other.
    if (entry.indexable !== payload.indexable) {
      throw new PrerenderError(
        `The index and the page payload disagree on whether ${pagePath} is indexable. ` +
          'The catalog may have changed mid-build; run the build again.',
      );
    }

    jobs.set(pagePath, {
      path: pagePath,
      queries: [
        {
          queryKey: queryKeys.publicCatalog.variant(
            payload.segment,
            payload.make.slug,
            payload.model.slug,
            payload.generation.slug,
            payload.variant.slug,
          ),
          data: payload,
        },
      ],
      head: variantPageHead(payload, { origin, indexing }),
      passesGate: payload.indexable,
      indexed: isPageIndexed(payload, indexing),
      lastmod: entry.updatedAt,
    });
  }

  return [...jobs.values()];
}

/**
 * The index's variants by model address, each variant address once (the first
 * index row wins, as for variant pages). Hyundai's car and SUV make rows share
 * a slug, so one model address can gather rows from both.
 */
function variantsByModelAddress(entries: PublicCatalogIndexEntry[]) {
  const models = new Map<string, Map<string, PublicCatalogIndexEntry>>();
  for (const entry of entries) {
    const modelPath = publicModelPath(entry);
    const variants = models.get(modelPath) ?? new Map<string, PublicCatalogIndexEntry>();
    const variantPath = publicVariantPath(entry);
    if (!variants.has(variantPath)) variants.set(variantPath, entry);
    models.set(modelPath, variants);
  }
  return new Map([...models].map(([modelPath, variants]) => [modelPath, [...variants.values()]]));
}

function modelJobs(
  entries: PublicCatalogIndexEntry[],
  payloads: PublicCatalogModelPage[],
  { origin, indexing }: { origin: string; indexing: boolean },
): PageJob[] {
  const payloadsByPath = new Map(payloads.map((payload) => [publicModelPath(payload), payload]));
  const jobs: PageJob[] = [];

  for (const [pagePath, children] of variantsByModelAddress(entries)) {
    const payload = payloadsByPath.get(pagePath);
    if (!payload) {
      throw new PrerenderError(
        `The index lists variants of ${pagePath} but the model pages did not include it. ` +
          'The catalog may have changed mid-build; run the build again.',
      );
    }
    if (indexing && typeof payload.indexable !== 'boolean') {
      throw new PrerenderError(
        `Indexing is on, but the catalog API gave ${pagePath} no page-quality verdict. ` +
          'Deploy the API with the page-quality gate first.',
      );
    }
    // The API's gate passes a model page when it passes any of its variants. A
    // model page that disagrees with its own variants' verdicts would leave
    // the sitemap and the pages it links to telling different stories.
    if (
      typeof payload.indexable === 'boolean' &&
      payload.indexable !== children.some((child) => child.indexable)
    ) {
      throw new PrerenderError(
        `The model page ${pagePath} and its variants disagree on whether it is indexable. ` +
          'The catalog may have changed mid-build; run the build again.',
      );
    }

    jobs.push({
      path: pagePath,
      queries: [
        {
          queryKey: queryKeys.publicCatalog.model(
            payload.segment,
            payload.make.slug,
            payload.model.slug,
          ),
          data: payload,
        },
      ],
      head: modelPageHead(payload, { origin, indexing }),
      passesGate: payload.indexable,
      indexed: isPageIndexed(payload, indexing),
      lastmod: newestUpdatedAt(children.map((child) => child.updatedAt)),
    });
  }

  return jobs;
}

type ApiEnvelope<T> = { success?: boolean; data?: T };

async function fetchApiData<T>(
  url: string,
  {
    fetcher,
    log,
    sleep,
  }: {
    fetcher: PrerenderFetch;
    log: (line: string) => void;
    sleep: (ms: number) => Promise<void>;
  },
): Promise<T> {
  let unreachable = 0;
  let rateLimited = 0;

  for (;;) {
    let response: Awaited<ReturnType<PrerenderFetch>>;
    try {
      response = await fetcher(url, { headers: { accept: 'application/json' } });
    } catch (error) {
      unreachable += 1;
      if (unreachable < MAX_ATTEMPTS_UNREACHABLE) {
        await sleep(1000 * unreachable);
        continue;
      }
      throw new PrerenderError(
        `Could not reach the catalog API at ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (response.status === 429 && rateLimited < MAX_RATE_LIMITED_WAITS) {
      rateLimited += 1;
      const waitMs = retryAfterMs(response.headers.get('retry-after'));
      log(`Rate limited on ${url}; waiting ${Math.ceil(waitMs / 1000)}s as asked.`);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      throw new PrerenderError(`The catalog API answered ${response.status} for ${url}.`);
    }

    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!body || body.success !== true || body.data === undefined) {
      throw new PrerenderError(`The catalog API sent an unexpected body for ${url}.`);
    }
    return body.data;
  }
}

function retryAfterMs(header: string | null) {
  if (header === null || header.trim() === '') return 10_000;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const date = header ? Date.parse(header) : NaN;
  if (Number.isFinite(date)) {
    return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return 10_000;
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  PublicCatalogIndex,
  PublicCatalogIndexEntry,
  PublicCatalogVariantPage,
  PublicCatalogVariantPageBatch,
} from '@vehicle-vault/shared';
import { PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX } from '@vehicle-vault/shared';

import {
  CANONICAL_ORIGIN,
  publicVariantPath,
  renderHeadTags,
  variantPageHead,
  type PublicPageHead,
} from '@/features/public-catalog/head/public-page-head';
import { queryKeys } from '@/lib/query/query-keys';

import { composeDocument } from './compose-document';
import { renderAppAtUrl, type RenderedApp, type SeededQuery } from './render-app';

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
  /** The canonical origin for head tags. */
  origin?: string;
  log?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
  render?: (url: string, queries: SeededQuery[]) => Promise<RenderedApp>;
};

export type PrerenderSummary = {
  /** Site paths written, e.g. `/cars/honda/city/city-lineup/vx`. */
  paths: string[];
  variantPages: number;
};

export class PrerenderError extends Error {
  override name = 'PrerenderError';
}

/**
 * A page the prerender writes: where it lives, the queries its route reads,
 * and its head. Variant pages are the first kind; model, make and browse pages
 * (#176, #177) become jobs the same way, with their own payloads and heads.
 */
type PageJob = {
  path: string;
  queries: SeededQuery[];
  head: PublicPageHead;
};

const MAX_ATTEMPTS_UNREACHABLE = 3;
const MAX_RATE_LIMITED_WAITS = 5;
const MAX_RETRY_AFTER_MS = 60_000;
/** A slug straight from the catalog's `slug` columns: nothing that could leave its directory. */
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Writes a static `index.html` for every publishable catalog variant into the
 * client build, so the page's content and link preview exist before any
 * JavaScript runs. Fails — and so fails the deploy — when the catalog API
 * cannot be read or has nothing in it, rather than shipping an empty catalog.
 */
export async function prerenderPublicCatalog(options: PrerenderOptions): Promise<PrerenderSummary> {
  const startedAt = Date.now();
  const {
    distDir,
    fetch: fetcher = globalThis.fetch as PrerenderFetch,
    origin = CANONICAL_ORIGIN,
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
  const jobs = variantJobs(index.variants, payloads, origin);

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

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`Prerendered ${written} pages (${written} variant pages) into ${distDir} in ${seconds}s.`);

  return { paths: jobs.map((job) => job.path), variantPages: written };
}

async function fetchAllVariantPages(
  apiBaseUrl: string,
  expected: number,
  getData: <T>(url: string) => Promise<T>,
): Promise<PublicCatalogVariantPage[]> {
  const pageSize = PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX;
  // A few pages of slack for rows published between the index and the batches;
  // past that something is wrong, and looping on would never end.
  const maxPages = Math.ceil(expected / pageSize) + 5;
  const pages: PublicCatalogVariantPage[] = [];

  for (let page = 1; ; page += 1) {
    if (page > maxPages) {
      throw new PrerenderError(`The variant pages did not end after ${maxPages} batches.`);
    }
    const batch = await getData<PublicCatalogVariantPageBatch>(
      `${apiBaseUrl}/public-catalog/variant-pages?page=${page}&pageSize=${pageSize}`,
    );
    if (!Array.isArray(batch?.items)) {
      throw new PrerenderError(`Batch ${page} of the variant pages had no items.`);
    }
    pages.push(...batch.items);
    if (!batch.hasMore) break;
  }

  return pages;
}

function variantJobs(
  entries: PublicCatalogIndexEntry[],
  payloads: PublicCatalogVariantPage[],
  origin: string,
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
      head: variantPageHead(payload, { origin }),
    });
  }

  return [...jobs.values()];
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

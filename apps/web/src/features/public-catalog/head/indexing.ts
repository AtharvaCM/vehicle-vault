/**
 * Whether public catalog pages may be indexed at all: the build-time switch
 * `VITE_PUBLIC_CATALOG_INDEXING`, off unless set to `on` (or `true` / `1`).
 *
 * It stays off until the author signs off on the catalog data's provenance
 * (PRD #169). Off, every page is `noindex` and the build writes no sitemap. On,
 * the API's page-quality gate decides page by page.
 *
 * One setting read at build time by both bundles: the prerender writes the
 * static `robots` tag with it, and the client puts the same tag back after an
 * SPA navigation. `build:prerendered` runs both builds in one environment, so
 * they always agree; set it for the whole build, never for one step.
 */
export const PUBLIC_CATALOG_INDEXING = parseIndexingFlag(
  import.meta.env.VITE_PUBLIC_CATALOG_INDEXING,
);

export function parseIndexingFlag(value: string | undefined): boolean {
  return ['on', 'true', '1'].includes((value ?? '').trim().toLowerCase());
}

/**
 * The one rule for whether a page is indexed: the flag is on and the gate
 * passed the page. The flag overrides the gate; the gate never overrides the
 * flag.
 */
export function isPageIndexed(
  page: { indexable: boolean },
  indexing: boolean = PUBLIC_CATALOG_INDEXING,
): boolean {
  return indexing && page.indexable;
}

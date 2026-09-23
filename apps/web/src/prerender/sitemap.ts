import { escapeHtml } from '@/features/public-catalog/head/public-page-head';

/** One page in the sitemap: its site path and when anything under it last changed. */
export type SitemapEntry = {
  /** A site path such as `/cars/honda/city/city-lineup/vx`. */
  path: string;
  /** ISO timestamp: the newest `updatedAt` in the page's subtree. */
  lastmod: string;
};

/** The most URLs one sitemap file may list (sitemaps.org). Past it, the build needs a sitemap index. */
export const SITEMAP_MAX_URLS = 50_000;

/**
 * The newest of a page's subtree timestamps: a variant page passes its own; a
 * model, make or browse page passes those of every variant under it.
 */
export function newestUpdatedAt(timestamps: ReadonlyArray<string>): string {
  if (timestamps.length === 0) throw new Error('A page with nothing under it has no lastmod.');
  return timestamps.reduce((newest, timestamp) =>
    Date.parse(timestamp) > Date.parse(newest) ? timestamp : newest,
  );
}

/**
 * `sitemap.xml` for the given pages, each `<loc>` absolute on the canonical
 * origin. The caller passes indexable pages only.
 */
export function renderSitemap(entries: ReadonlyArray<SitemapEntry>, origin: string) {
  if (entries.length > SITEMAP_MAX_URLS) {
    throw new Error(
      `${entries.length} pages is more than one sitemap may list (${SITEMAP_MAX_URLS}); split it with a sitemap index.`,
    );
  }
  const base = origin.replace(/\/+$/, '');
  const urls = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeHtml(`${base}${entry.path}`)}</loc>\n    <lastmod>${w3cDatetime(
          entry.lastmod,
        )}</lastmod>\n  </url>\n`,
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    '</urlset>\n'
  );
}

/**
 * `robots.txt`: everything may be crawled, the landing page and app included.
 * Catalog pages that should stay out of search say so with their own
 * `noindex`, which a crawler can only read if it is allowed to fetch the page.
 * It names the sitemap, on the canonical origin, only when there is one.
 */
export function renderRobots({ sitemapUrl }: { sitemapUrl: string | null }) {
  return ['User-agent: *', 'Allow: /', ...(sitemapUrl ? ['', `Sitemap: ${sitemapUrl}`] : [])]
    .join('\n')
    .concat('\n');
}

/** `2026-07-10T08:30:00Z`: W3C Datetime to the second, as sitemaps expect. */
function w3cDatetime(iso: string) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) throw new Error(`"${iso}" is not a timestamp.`);
  return new Date(time).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { newestUpdatedAt, renderRobots, renderSitemap, SITEMAP_MAX_URLS } from './sitemap';

const ORIGIN = 'https://catalog.example.test';

describe('renderSitemap', () => {
  it('lists each page absolute on the origin, in path order, with its lastmod to the second', () => {
    const xml = renderSitemap(
      [
        { path: '/cars/b', lastmod: '2026-08-01T12:34:56.789Z' },
        { path: '/bikes/a', lastmod: '2026-07-10T00:00:00.000Z' },
      ],
      `${ORIGIN}/`,
    );

    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        `  <url>\n    <loc>${ORIGIN}/bikes/a</loc>\n    <lastmod>2026-07-10T00:00:00Z</lastmod>\n  </url>\n` +
        `  <url>\n    <loc>${ORIGIN}/cars/b</loc>\n    <lastmod>2026-08-01T12:34:56Z</lastmod>\n  </url>\n` +
        '</urlset>\n',
    );
  });

  it('is a valid empty urlset with no pages', () => {
    expect(renderSitemap([], ORIGIN)).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n',
    );
  });

  it('escapes what XML would misread', () => {
    const xml = renderSitemap(
      [{ path: '/cars/a?b=1&c=2', lastmod: '2026-07-10T00:00:00Z' }],
      ORIGIN,
    );

    expect(xml).toContain(`<loc>${ORIGIN}/cars/a?b=1&amp;c=2</loc>`);
  });

  it('refuses more pages than one sitemap may hold, or a bad timestamp', () => {
    const tooMany = Array.from({ length: SITEMAP_MAX_URLS + 1 }, (_, i) => ({
      path: `/cars/${i}`,
      lastmod: '2026-07-10T00:00:00Z',
    }));
    expect(() => renderSitemap(tooMany, ORIGIN)).toThrow(/sitemap index/);
    expect(() => renderSitemap([{ path: '/cars/a', lastmod: 'yesterday' }], ORIGIN)).toThrow(
      /not a timestamp/,
    );
  });
});

describe('newestUpdatedAt', () => {
  it("picks the newest of a page's subtree", () => {
    expect(
      newestUpdatedAt([
        '2026-07-10T00:00:00.000Z',
        '2026-08-01T12:34:56.789Z',
        '2026-07-31T23:59:59.999Z',
      ]),
    ).toBe('2026-08-01T12:34:56.789Z');
  });

  it('refuses an empty subtree', () => {
    expect(() => newestUpdatedAt([])).toThrow();
  });
});

describe('renderRobots', () => {
  it('allows everything, the app included, and names the sitemap when there is one', () => {
    expect(renderRobots({ sitemapUrl: `${ORIGIN}/sitemap.xml` })).toBe(
      `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
    );
    expect(renderRobots({ sitemapUrl: null })).toBe('User-agent: *\nAllow: /\n');
  });

  it('never disallows anything', () => {
    expect(renderRobots({ sitemapUrl: null })).not.toMatch(/Disallow/i);
    expect(renderRobots({ sitemapUrl: `${ORIGIN}/sitemap.xml` })).not.toMatch(/Disallow/i);
  });
});

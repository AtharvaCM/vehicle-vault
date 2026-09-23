/**
 * `pnpm --filter @vehicle-vault/web build:prerendered` runs this after the
 * client build, from the SSR bundle in `dist-ssr/`.
 *
 * Opt-in: with no `PRERENDER_API_BASE_URL` it does nothing, so CI and local
 * builds need no API. Set, it fails the build on an unreachable API or an
 * empty catalog. The Vercel production build sets it (see `vercel.json`).
 */
import path from 'node:path';

import { prerenderPublicCatalog } from './prerender';

const apiBaseUrl = process.env.PRERENDER_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  console.log('Prerender skipped: PRERENDER_API_BASE_URL is not set.');
} else {
  const distDir = path.resolve(process.env.PRERENDER_DIST_DIR ?? 'dist');
  console.log(`Prerendering public catalog pages from ${apiBaseUrl} into ${distDir}.`);

  prerenderPublicCatalog({ apiBaseUrl, distDir }).then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(`Prerender failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    },
  );
}

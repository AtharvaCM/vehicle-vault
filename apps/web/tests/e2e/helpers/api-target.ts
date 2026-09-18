/**
 * Which API the e2e suite's Vite server proxies to, and the guard that keeps it
 * off production.
 *
 * Every spec registers a fresh user, so every run against a real API leaves
 * accounts behind. This used to default to the production API, which
 * is how 25 of the 26 accounts there came to be test addresses.
 *
 * Kept free of Playwright imports so it can be unit-tested with Vitest and
 * evaluated at config load — which is what makes a refusal land before the dev
 * server boots or any spec runs.
 */

/** The local API from `pnpm dev:api`, and what CI already sets explicitly. */
export const LOCAL_API_TARGET = 'http://127.0.0.1:3001';

/** The one host this suite must never touch by accident. */
export const PRODUCTION_API_HOST = 'vehiclevault.middle-earth.in';

type Env = Record<string, string | undefined>;

export function resolveApiProxyTarget(env: Env): string {
  const target = env.E2E_API_PROXY_TARGET?.trim() || LOCAL_API_TARGET;

  let url: URL | null = null;
  try {
    url = new URL(target);
  } catch {
    // Reported below with the scheme check.
  }

  // The scheme check is not pedantry: WHATWG URL parses `localhost:3001` as a
  // URL whose scheme is `localhost:` and whose host is empty, so without it the
  // most natural way to type a local target would slip past the production
  // check and hand the dev server a proxy target it cannot use.
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(
      `E2E_API_PROXY_TARGET must be an http(s) URL such as ${LOCAL_API_TARGET}; got "${target}".`,
    );
  }

  const host = url.hostname.toLowerCase();

  if (host === PRODUCTION_API_HOST && !isSet(env.E2E_ALLOW_PRODUCTION_API)) {
    throw new Error(
      [
        `Refusing to run the e2e suite against the production API (${target}).`,
        'Every spec registers a new user, so each run leaves accounts in the production database.',
        `Point it at a local API instead — the default, ${LOCAL_API_TARGET}, is what \`pnpm dev:api\` serves.`,
        'If you really mean production, set E2E_ALLOW_PRODUCTION_API=1 as well.',
      ].join('\n'),
    );
  }

  return target;
}

function isSet(value: string | undefined): boolean {
  return ['1', 'true', 'yes'].includes(value?.trim().toLowerCase() ?? '');
}

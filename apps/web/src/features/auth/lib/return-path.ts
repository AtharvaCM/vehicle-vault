import type { useNavigate } from '@tanstack/react-router';
import { toSafeReturnPath } from '@vehicle-vault/shared';

import { afterSignInDestination } from '@/features/catalog-intent/lib/catalog-intent';

/**
 * The `next` search parameter: the signed-in page a signed-out visitor was
 * heading for when the route guard sent them to sign in (see
 * `toSafeReturnPath` in the shared package for what is accepted).
 */
export type ReturnPathSearch = {
  next?: string;
};

/**
 * `validateSearch` for the pages that take a `next` parameter. Anything that
 * is not a same-origin path is dropped here, so no page ever sees it.
 */
export function validateReturnPathSearch(search: Record<string, unknown>): ReturnPathSearch {
  const next = toSafeReturnPath(search.next);
  return next ? { next } : {};
}

export type AfterAuthDestination = { href: string } | { to: '/vehicles/new' | '/home' };

/**
 * Where to go once signed in: back where the visitor was going, else on to a
 * vehicle picked on a catalog page, else the dashboard. `href` is a same-origin
 * path, so the router navigates in place rather than loading a new document.
 */
export function afterAuthDestination(next: string | undefined): AfterAuthDestination {
  const returnPath = toSafeReturnPath(next);
  return returnPath ? { href: returnPath } : { to: afterSignInDestination() };
}

/** Goes to an `afterAuthDestination`. */
export function navigateAfterAuth(
  navigate: ReturnType<typeof useNavigate>,
  destination: AfterAuthDestination,
  options: { replace?: boolean } = {},
) {
  return 'href' in destination
    ? navigate({ href: destination.href, ...options })
    : navigate({ to: destination.to, ...options });
}

/**
 * The sign-in address for a session that ended on `location`, carrying it as
 * `next` when it is somewhere worth returning to.
 */
export function loginHrefReturningTo(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  const next = toSafeReturnPath(`${location.pathname}${location.search}${location.hash}`);
  return next ? `/login?${new URLSearchParams({ next }).toString()}` : '/login';
}

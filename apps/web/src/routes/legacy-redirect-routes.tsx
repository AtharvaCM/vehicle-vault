import { createRoute, redirect } from '@tanstack/react-router';

import { rootRoute } from './root-route';

/**
 * The top level was renamed in the Phase 2 navigation (#275): Dashboard became
 * Home, Vehicles Garage, Reminders Upcoming, Maintenance History and Loans
 * Costs. The old addresses live on in bookmarks, installed apps that started
 * on them, emails and push notifications already sent, so each one forwards
 * to its new page with the query string and hash intact. They sit outside the
 * signed-in guard: the new page's own guard then sends a signed-out visitor to
 * sign-in with the new address as the return path.
 *
 * Only the exact list addresses move. `/vehicles/new`, `/vehicles/$vehicleId`
 * and `/reminders/$reminderId` are their own routes and are unaffected.
 */
export const LEGACY_REDIRECTS = {
  '/dashboard': '/home',
  '/vehicles': '/garage',
  '/reminders': '/upcoming',
  '/maintenance': '/history',
  '/loans': '/costs',
} as const;

function createLegacyRedirectRoute(from: keyof typeof LEGACY_REDIRECTS) {
  const to = LEGACY_REDIRECTS[from];

  return createRoute({
    getParentRoute: () => rootRoute,
    path: from.slice(1),
    beforeLoad: ({ location }) => {
      // The raw parsed query: the new page's `validateSearch` normalises it.
      throw redirect({
        to,
        search: location.search as never,
        hash: location.hash || undefined,
        replace: true,
      });
    },
  });
}

export const legacyDashboardRoute = createLegacyRedirectRoute('/dashboard');
export const legacyVehiclesRoute = createLegacyRedirectRoute('/vehicles');
export const legacyRemindersRoute = createLegacyRedirectRoute('/reminders');
export const legacyMaintenanceRoute = createLegacyRedirectRoute('/maintenance');
export const legacyLoansRoute = createLegacyRedirectRoute('/loans');

export const legacyRedirectRoutes = [
  legacyDashboardRoute,
  legacyVehiclesRoute,
  legacyRemindersRoute,
  legacyMaintenanceRoute,
  legacyLoansRoute,
];

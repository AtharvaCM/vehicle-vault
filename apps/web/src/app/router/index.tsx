import { createRouter } from '@tanstack/react-router';

import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { RouteError } from '@/components/errors/route-error';
import { queryClient } from '@/lib/query/query-client';
import {
  adminCatalogRoute,
  adminIndexRoute,
  adminRoute,
  adminUsersRoute,
  adminMessagesRoute,
  appRoute,
  forgotPasswordRoute,
  homeRoute,
  indexRoute,
  loginRoute,
  oauthCallbackRoute,
  costsRoute,
  loanRoute,
  garageRoute,
  historyRoute,
  legacyRedirectRoutes,
  maintenanceRecordDetailRoute,
  maintenanceRecordEditRoute,
  reminderDetailRoute,
  reminderEditRoute,
  registerRoute,
  resetPasswordRoute,
  rootRoute,
  settingsRoute,
  settingsActivityRoute,
  settingsPreferencesRoute,
  vehicleDetailRoute,
  vehicleDocumentRoute,
  vehicleEditRoute,
  vehicleMaintenanceNewRoute,
  vehicleMaintenanceRoute,
  vehiclePapersRoute,
  vehicleRemindersNewRoute,
  vehicleRemindersRoute,
  upcomingRoute,
  vehiclesNewRoute,
  verifyEmailRoute,
  acceptInviteRoute,
  contactRoute,
  privacyRoute,
  termsRoute,
  bikesVariantRoute,
  carsVariantRoute,
  bikesModelRoute,
  carsModelRoute,
  bikesMakeRoute,
  carsMakeRoute,
  bikesBrowseRoute,
  carsBrowseRoute,
} from '@/routes';

const protectedRouteTree = appRoute.addChildren([
  homeRoute,
  garageRoute,
  vehiclesNewRoute,
  vehicleDetailRoute,
  vehiclePapersRoute,
  vehicleDocumentRoute,
  vehicleEditRoute,
  historyRoute,
  vehicleMaintenanceRoute,
  vehicleMaintenanceNewRoute,
  maintenanceRecordDetailRoute,
  maintenanceRecordEditRoute,
  vehicleRemindersRoute,
  vehicleRemindersNewRoute,
  upcomingRoute,
  reminderDetailRoute,
  reminderEditRoute,
  costsRoute,
  loanRoute,
  settingsRoute,
  settingsActivityRoute,
  settingsPreferencesRoute,
  adminRoute.addChildren([adminIndexRoute, adminUsersRoute, adminMessagesRoute, adminCatalogRoute]),
]);

/** Exported so tests can build a router over the real tree with their own history. */
export const routeTree = rootRoute.addChildren([
  indexRoute,
  forgotPasswordRoute,
  loginRoute,
  oauthCallbackRoute,
  registerRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  // Public for everyone: the footer's Privacy, Terms and Contact (#341).
  privacyRoute,
  termsRoute,
  contactRoute,
  // Public: an invite link is previewed before anyone signs in.
  acceptInviteRoute,
  carsVariantRoute,
  bikesVariantRoute,
  carsModelRoute,
  bikesModelRoute,
  carsMakeRoute,
  bikesMakeRoute,
  carsBrowseRoute,
  bikesBrowseRoute,
  // Old top-level addresses, forwarded to their renamed pages.
  ...legacyRedirectRoutes,
  protectedRouteTree,
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined!,
    queryClient,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  // Without these a render exception is a blank page and an unknown address
  // renders nothing. Both apply to every route that does not set its own.
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFoundScreen,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

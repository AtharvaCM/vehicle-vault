import { createRouter } from '@tanstack/react-router';

import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { RouteError } from '@/components/errors/route-error';
import { queryClient } from '@/lib/query/query-client';
import {
  adminUsersRoute,
  appRoute,
  dashboardRoute,
  forgotPasswordRoute,
  indexRoute,
  loginRoute,
  oauthCallbackRoute,
  loansRoute,
  maintenanceRoute,
  maintenanceRecordDetailRoute,
  maintenanceRecordEditRoute,
  reminderDetailRoute,
  reminderEditRoute,
  remindersRoute,
  registerRoute,
  resetPasswordRoute,
  rootRoute,
  settingsRoute,
  settingsActivityRoute,
  vehicleDetailRoute,
  vehicleEditRoute,
  vehicleMaintenanceNewRoute,
  vehicleMaintenanceRoute,
  vehicleRemindersNewRoute,
  vehicleRemindersRoute,
  vehiclesNewRoute,
  vehiclesRoute,
  verifyEmailRoute,
  acceptInviteRoute,
} from '@/routes';

const protectedRouteTree = appRoute.addChildren([
  dashboardRoute,
  vehiclesRoute,
  vehiclesNewRoute,
  vehicleDetailRoute,
  vehicleEditRoute,
  maintenanceRoute,
  vehicleMaintenanceRoute,
  vehicleMaintenanceNewRoute,
  maintenanceRecordDetailRoute,
  maintenanceRecordEditRoute,
  vehicleRemindersRoute,
  vehicleRemindersNewRoute,
  remindersRoute,
  reminderDetailRoute,
  reminderEditRoute,
  loansRoute,
  settingsRoute,
  settingsActivityRoute,
  adminUsersRoute,
  acceptInviteRoute,
]);

const routeTree = rootRoute.addChildren([
  indexRoute,
  forgotPasswordRoute,
  loginRoute,
  oauthCallbackRoute,
  registerRoute,
  resetPasswordRoute,
  verifyEmailRoute,
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

import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/query/query-client';
import {
  appRoute,
  dashboardRoute,
  indexRoute,
  loginRoute,
  maintenanceRecordDetailRoute,
  reminderDetailRoute,
  remindersRoute,
  registerRoute,
  rootRoute,
  settingsRoute,
  vehicleDetailRoute,
  vehicleMaintenanceNewRoute,
  vehicleMaintenanceRoute,
  vehicleRemindersNewRoute,
  vehicleRemindersRoute,
  vehiclesNewRoute,
  vehiclesRoute,
} from '@/routes';

const protectedRouteTree = appRoute.addChildren([
  dashboardRoute,
  vehiclesRoute,
  vehiclesNewRoute,
  vehicleDetailRoute,
  vehicleMaintenanceRoute,
  vehicleMaintenanceNewRoute,
  maintenanceRecordDetailRoute,
  vehicleRemindersRoute,
  vehicleRemindersNewRoute,
  remindersRoute,
  reminderDetailRoute,
  settingsRoute,
]);

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
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
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

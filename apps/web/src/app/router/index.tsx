import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/query/query-client';
import {
  appRoute,
  dashboardRoute,
  indexRoute,
  loginRoute,
  maintenanceRoute,
  maintenanceRecordDetailRoute,
  maintenanceRecordEditRoute,
  reminderDetailRoute,
  reminderEditRoute,
  remindersRoute,
  registerRoute,
  rootRoute,
  settingsRoute,
  vehicleDetailRoute,
  vehicleEditRoute,
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

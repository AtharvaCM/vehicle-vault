import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/query/query-client';
import {
  dashboardRoute,
  indexRoute,
  maintenanceRecordDetailRoute,
  remindersRoute,
  rootRoute,
  settingsRoute,
  vehicleDetailRoute,
  vehicleMaintenanceNewRoute,
  vehicleMaintenanceRoute,
  vehiclesNewRoute,
  vehiclesRoute,
} from '@/routes';

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  vehiclesRoute,
  vehiclesNewRoute,
  vehicleDetailRoute,
  vehicleMaintenanceRoute,
  vehicleMaintenanceNewRoute,
  maintenanceRecordDetailRoute,
  remindersRoute,
  settingsRoute,
]);

export const router = createRouter({
  routeTree,
  context: {
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

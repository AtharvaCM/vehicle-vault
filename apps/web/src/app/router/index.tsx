import { createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/query/query-client';
import {
  dashboardRoute,
  indexRoute,
  maintenanceRecordDetailRoute,
  reminderDetailRoute,
  remindersRoute,
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

const routeTree = rootRoute.addChildren([
  indexRoute,
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

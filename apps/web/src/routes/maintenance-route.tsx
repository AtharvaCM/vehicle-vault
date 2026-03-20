import { createRoute } from '@tanstack/react-router';

import { MaintenanceOverviewPage } from '@/features/maintenance/pages/maintenance-overview-page';

import { appRoute } from './app-route';

export const maintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance',
  component: MaintenanceOverviewPage,
});

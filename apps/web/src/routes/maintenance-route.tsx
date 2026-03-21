import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const MaintenanceOverviewPage = createLazyPage(
  () =>
    import('@/features/maintenance/pages/maintenance-overview-page').then((module) => ({
      default: module.MaintenanceOverviewPage,
    })),
  {
    title: 'Loading maintenance',
    description: 'Loading your service history.',
  },
);

export const maintenanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'maintenance',
  component: MaintenanceOverviewPage,
});

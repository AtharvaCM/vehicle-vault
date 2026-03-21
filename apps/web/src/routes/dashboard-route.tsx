import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const DashboardPage = createLazyPage(
  () =>
    import('@/features/dashboard/pages/dashboard-page').then((module) => ({
      default: module.DashboardPage,
    })),
  {
    title: 'Loading dashboard',
    description: 'Preparing the latest garage summary.',
  },
);

export const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'dashboard',
  component: DashboardPage,
});

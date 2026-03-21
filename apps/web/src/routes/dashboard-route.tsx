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
    description: 'Loading your garage summary.',
  },
);

export const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'dashboard',
  component: DashboardPage,
});

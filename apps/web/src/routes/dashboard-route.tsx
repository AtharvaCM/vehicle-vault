import { createRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/features/dashboard/pages/dashboard-page';

import { rootRoute } from './root-route';

export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  component: DashboardPage,
});

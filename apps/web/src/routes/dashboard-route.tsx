import { createRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/features/dashboard/pages/dashboard-page';

import { appRoute } from './app-route';

export const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'dashboard',
  component: DashboardPage,
});

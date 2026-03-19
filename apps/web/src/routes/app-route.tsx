import { Outlet, createRoute, redirect } from '@tanstack/react-router';

import { AppShell } from '@/components/layout/app-shell';

import { rootRoute } from './root-route';

function AppRouteComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppRouteComponent,
});

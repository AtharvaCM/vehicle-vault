import { Outlet, createRoute, redirect } from '@tanstack/react-router';
import { toSafeReturnPath } from '@vehicle-vault/shared';

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
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      // Sign-in, registration and OAuth carry this back here afterwards.
      throw redirect({ to: '/login', search: { next: toSafeReturnPath(location.href) } });
    }
  },
  component: AppRouteComponent,
});

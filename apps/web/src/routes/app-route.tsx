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
  beforeLoad: ({ cause, context, location }) => {
    if (!context.auth.isAuthenticated) {
      // Opening a signed-in page while signed out: sign-in, registration and
      // OAuth carry it back here afterwards. Not when the session ends on the
      // page itself ('stay'): signing out is not a trip to come back from, and
      // an expired session sends its own return path (`loginHrefReturningTo`).
      const next = cause === 'enter' ? toSafeReturnPath(location.href) : undefined;
      throw redirect({ to: '/login', search: next ? { next } : {} });
    }
  },
  component: AppRouteComponent,
});

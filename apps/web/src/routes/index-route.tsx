import { createRoute, redirect } from '@tanstack/react-router';

import { rootRoute } from './root-route';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    throw redirect({ to: context.auth.isAuthenticated ? '/dashboard' : '/login' });
  },
});

import { createRoute, redirect } from '@tanstack/react-router';

import { LoginPage } from '@/features/auth/pages/login-page';

import { rootRoute } from './root-route';

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

import { createRoute, redirect } from '@tanstack/react-router';

import { RegisterPage } from '@/features/auth/pages/register-page';

import { rootRoute } from './root-route';

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'register',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: RegisterPage,
});

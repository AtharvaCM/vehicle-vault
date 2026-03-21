import { createRoute, redirect } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const LoginPage = createLazyPage(
  () =>
    import('@/features/auth/pages/login-page').then((module) => ({
      default: module.LoginPage,
    })),
  {
    title: 'Loading sign in',
    description: 'Preparing your account access screen.',
  },
);

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

import { createRoute, redirect } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const RegisterPage = createLazyPage(
  () =>
    import('@/features/auth/pages/register-page').then((module) => ({
      default: module.RegisterPage,
    })),
  {
    title: 'Loading registration',
    description: 'Loading your account setup.',
  },
);

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

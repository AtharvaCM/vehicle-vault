import { createRoute, redirect } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const ResetPasswordPage = createLazyPage(
  () =>
    import('@/features/auth/pages/reset-password-page').then((module) => ({
      default: module.ResetPasswordPage,
    })),
  {
    title: 'Loading password reset',
    description: 'Preparing the password update screen.',
  },
);

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'reset-password',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: ResetPasswordPage,
});

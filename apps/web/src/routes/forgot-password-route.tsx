import { createRoute, redirect } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const ForgotPasswordPage = createLazyPage(
  () =>
    import('@/features/auth/pages/forgot-password-page').then((module) => ({
      default: module.ForgotPasswordPage,
    })),
  {
    title: 'Loading password reset',
    description: 'Preparing the password reset flow.',
  },
);

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'forgot-password',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: ForgotPasswordPage,
});

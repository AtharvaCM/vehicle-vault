import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const VerifyEmailPage = createLazyPage(
  () =>
    import('@/features/auth/pages/verify-email-page').then((module) => ({
      default: module.VerifyEmailPage,
    })),
  {
    title: 'Verifying Email',
    description: 'We are verifying your email address.',
  },
);

export const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'verify-email',
  validateSearch: z.object({
    token: z.string().optional(),
  }),
  component: VerifyEmailPage,
});

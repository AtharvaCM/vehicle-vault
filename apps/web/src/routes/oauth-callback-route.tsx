import { createRoute } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const OAuthCallbackPage = createLazyPage(
  () =>
    import('@/features/auth/pages/oauth-callback-page').then((module) => ({
      default: module.OAuthCallbackPage,
    })),
  {
    title: 'Finishing sign in',
    description: 'Completing your OAuth sign-in.',
  },
);

export const oauthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'auth/oauth-callback',
  component: OAuthCallbackPage,
});

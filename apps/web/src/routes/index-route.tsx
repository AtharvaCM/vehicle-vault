import { createRoute, redirect } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const LandingPage = createLazyPage(
  () =>
    import('@/features/landing/pages/landing-page').then((module) => ({
      default: module.LandingPage,
    })),
  {
    title: 'Loading Vehicle Vault',
    description: 'Loading the home page.',
  },
);

/**
 * The front door. Signed-in users go straight to their dashboard; everyone else
 * gets the landing page rather than a bare sign-in form, so a stranger can find
 * out what this is before being asked for an email address.
 */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: LandingPage,
});

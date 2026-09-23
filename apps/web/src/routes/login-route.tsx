import { createRoute, redirect } from '@tanstack/react-router';

import { validateReturnPathSearch } from '@/features/auth/lib/return-path';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const LoginPage = createLazyPage(
  () =>
    import('@/features/auth/pages/login-page').then((module) => ({
      default: module.LoginPage,
    })),
  {
    title: 'Loading sign in',
    description: 'Loading your sign-in screen.',
  },
);

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  // `next`: where the route guard was taking a signed-out visitor.
  validateSearch: validateReturnPathSearch,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw search.next ? redirect({ href: search.next }) : redirect({ to: '/dashboard' });
    }
  },
  component: LoginPage,
});

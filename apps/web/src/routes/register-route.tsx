import { createRoute, redirect } from '@tanstack/react-router';

import { validateReturnPathSearch } from '@/features/auth/lib/return-path';
import { validateCatalogIntentSearch } from '@/features/catalog-intent/lib/catalog-intent';

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
  // `catalog`: a catalog intent from a public page's "Track this vehicle".
  // `next`: where the route guard was taking a signed-out visitor.
  validateSearch: (search: Record<string, unknown>) => ({
    ...validateCatalogIntentSearch(search),
    ...validateReturnPathSearch(search),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      // Already signed in: straight on to where they were going, or to the
      // form the intent is for.
      if (search.next) {
        throw redirect({ href: search.next });
      }
      throw search.catalog
        ? redirect({ to: '/vehicles/new', search: { catalog: search.catalog } })
        : redirect({ to: '/home' });
    }
  },
  component: RegisterPage,
});

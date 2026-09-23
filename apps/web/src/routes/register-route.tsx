import { createRoute, redirect } from '@tanstack/react-router';

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
  validateSearch: validateCatalogIntentSearch,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      // Already signed in: straight on to the form the intent is for.
      throw search.catalog
        ? redirect({ to: '/vehicles/new', search: { catalog: search.catalog } })
        : redirect({ to: '/dashboard' });
    }
  },
  component: RegisterPage,
});

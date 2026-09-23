import { createRoute } from '@tanstack/react-router';

import { createLazyPage } from './lazy-page';
import { rootRoute } from './root-route';

const PublicVariantRoutePage = createLazyPage(
  () =>
    import('@/features/public-catalog/pages/public-variant-page').then((module) => ({
      default: module.PublicVariantRoutePage,
    })),
  {
    title: 'Loading',
    description: 'Loading the specs and service schedule.',
  },
);

/**
 * Public catalog pages. Reachable signed in or out, and outside the app shell:
 * these are pages for strangers arriving from a search, not screens in the app.
 * Cars, SUVs and vans live under `/cars`, motorcycles under `/bikes`.
 */
export const carsVariantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'cars/$make/$model/$generation/$variant',
  component: function CarsVariantRoute() {
    const params = carsVariantRoute.useParams();
    return <PublicVariantRoutePage slugs={{ segment: 'cars', ...params }} />;
  },
});

export const bikesVariantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'bikes/$make/$model/$generation/$variant',
  component: function BikesVariantRoute() {
    const params = bikesVariantRoute.useParams();
    return <PublicVariantRoutePage slugs={{ segment: 'bikes', ...params }} />;
  },
});

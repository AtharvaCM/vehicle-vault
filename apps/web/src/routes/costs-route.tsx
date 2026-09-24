import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const CostsPage = createLazyPage(
  () =>
    import('@/features/analytics/pages/costs-page').then((module) => ({
      default: module.CostsPage,
    })),
  {
    title: 'Loading costs',
    description: 'Loading what your garage costs to run.',
  },
);

export const costsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'costs',
  component: CostsPage,
});

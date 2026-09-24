import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const LoansPage = createLazyPage(
  () =>
    import('@/features/loans/pages/loans-page').then((module) => ({
      default: module.LoansPage,
    })),
  {
    title: 'Loading costs',
    description: 'Loading your vehicle loans.',
  },
);

export const costsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'costs',
  component: LoansPage,
});

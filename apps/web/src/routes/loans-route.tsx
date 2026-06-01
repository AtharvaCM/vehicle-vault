import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const LoansPage = createLazyPage(
  () =>
    import('@/features/loans/pages/loans-page').then((module) => ({
      default: module.LoansPage,
    })),
  {
    title: 'Loading loans',
    description: 'Loading your vehicle loans.',
  },
);

export const loansRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'loans',
  component: LoansPage,
});

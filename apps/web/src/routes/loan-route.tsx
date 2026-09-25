import { createRoute } from '@tanstack/react-router';

import { appRoute } from './app-route';
import { createLazyPage } from './lazy-page';

const LoanPage = createLazyPage(
  () =>
    import('@/features/loans/pages/loan-page').then((module) => ({
      default: module.LoanPage,
    })),
  {
    title: 'Loading loan',
    description: 'Loading this loan and its schedule.',
  },
);

function LoanRouteComponent() {
  const { loanId } = loanRoute.useParams();

  return <LoanPage loanId={loanId} />;
}

/** A loan's own page, under Costs where every loan is listed (#312). Owners only: the API 404s others. */
export const loanRoute = createRoute({
  getParentRoute: () => appRoute,
  path: 'costs/loans/$loanId',
  component: LoanRouteComponent,
});

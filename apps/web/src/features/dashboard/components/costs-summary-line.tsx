import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Money } from '@/components/shared/money';
import { costSplitQueryOptions } from '@/features/analytics/api/get-cost-split';
import { rangeToParams } from '@/features/analytics/utils/range-to-params';

import type { DashboardLoanSummary } from '../types/dashboard';

type CostsSummaryLineProps = {
  loans: DashboardLoanSummary;
};

/**
 * Where Home's spend charts and loans card used to sit (#281: both moved to
 * Costs): one bordered link row reading the totals Costs opens onto. Never
 * shows a wrong number — loading drops to plain "Costs" text, and an errored
 * spend total drops the spend clause rather than guess at it.
 */
export function CostsSummaryLine({ loans }: CostsSummaryLineProps) {
  const costSplitQuery = useQuery(costSplitQueryOptions(rangeToParams('1y')));
  const hasLoans = loans.activeCount > 0;

  let content: ReactNode = 'Costs';

  if (costSplitQuery.isSuccess) {
    const spend = Number(costSplitQuery.data.buckets.total);
    content = (
      <>
        Spent in the last 12 months <Money value={spend} />
        {hasLoans ? (
          <>
            {' · '}Loan outstanding <Money value={loans.outstandingBalance} />
          </>
        ) : null}
      </>
    );
  } else if (costSplitQuery.isError && hasLoans) {
    content = (
      <>
        Loan outstanding <Money value={loans.outstandingBalance} />
      </>
    );
  }

  return (
    <Link
      className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3 text-body text-fg-2 transition-colors hover:bg-page/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      to="/costs"
    >
      <span>{content}</span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-3" />
    </Link>
  );
}

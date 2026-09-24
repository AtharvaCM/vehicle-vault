import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DashboardLoanSummary } from '../types/dashboard';

const getCostSplit = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/analytics/api/get-cost-split', () => ({
  costSplitQueryOptions: (params: unknown) => ({
    queryKey: ['cost-split', params],
    queryFn: () => getCostSplit(),
  }),
}));

import { CostsSummaryLine } from './costs-summary-line';

function loans(overrides: Partial<DashboardLoanSummary> = {}): DashboardLoanSummary {
  return {
    activeCount: 0,
    closedCount: 0,
    monthlyEmi: 0,
    outstandingBalance: 0,
    interestPaidToDate: 0,
    prepaidToDate: 0,
    nextEmiDate: null,
    ...overrides,
  };
}

function renderLine(loanSummary: DashboardLoanSummary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CostsSummaryLine loans={loanSummary} />
    </QueryClientProvider>,
  );
}

describe('CostsSummaryLine', () => {
  it('reads both the spend and the loan clause once they have loaded', async () => {
    getCostSplit.mockResolvedValue({
      currency: 'INR',
      range: { from: '2025-09-25T00:00:00.000Z', to: '2026-09-25T00:00:00.000Z' },
      buckets: {
        maintenance: '0',
        fuel: '0',
        insurance: '0',
        accessories: '0',
        loanInterest: '0',
        total: '60151',
      },
    });

    renderLine(loans({ activeCount: 1, outstandingBalance: 131624 }));

    expect(await screen.findByText('₹60,151')).toBeInTheDocument();
    expect(screen.getByText('₹1,31,624')).toBeInTheDocument();
    expect(screen.getByText(/Spent in the last 12 months/)).toBeInTheDocument();
    expect(screen.getByText(/Loan outstanding/)).toBeInTheDocument();
  });

  it('drops the spend clause and shows the loan figure alone when spend fails to load', async () => {
    getCostSplit.mockRejectedValue(new Error('network error'));

    renderLine(loans({ activeCount: 2, outstandingBalance: 45000 }));

    expect(await screen.findByText('₹45,000')).toBeInTheDocument();
    expect(screen.getByText(/Loan outstanding/)).toBeInTheDocument();
    expect(screen.queryByText(/Spent in the last 12 months/)).not.toBeInTheDocument();
  });

  it('shows plain "Costs" while spend is loading, never a guessed number', () => {
    getCostSplit.mockImplementation(() => new Promise(() => {}));

    renderLine(loans({ activeCount: 1, outstandingBalance: 20000 }));

    expect(screen.getByRole('link')).toHaveTextContent('Costs');
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });
});

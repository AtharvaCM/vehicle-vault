import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoanStatus, type VehicleLoan } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const loanQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const schedule = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: unknown; to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../hooks/use-loans', () => ({ useLoan: () => loanQuery.current }));
vi.mock('../hooks/use-loan-schedule', () => ({
  useLoanSchedule: () => ({ isLoading: false, isError: false, data: schedule.current }),
}));
vi.mock('../hooks/use-loan-actions', () => ({
  useAddPrepayment: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
  useDeletePrepayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useForecloseLoan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('../hooks/use-update-loan', () => ({
  useUpdateLoan: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => ({ data: { nickname: 'Weekend Bike', make: 'RE', model: 'Classic' } }),
}));
// Each fetches for itself; beside the point here.
vi.mock('../components/loan-attachments-section', () => ({
  LoanAttachmentsSection: () => <p>documents</p>,
}));
vi.mock('@/components/shared/chart', () => ({
  Chart: ({ label, marker }: { label: string; marker?: { at: string; label: string } }) => (
    <p>
      chart: {label}
      {marker ? ` · marker ${marker.label}` : ''}
    </p>
  ),
}));
vi.mock('../components/loan-form', () => ({ LoanForm: (): ReactNode => null }));

import { LoanPage, nextEmiDate } from './loan-page';

function loan(overrides: Partial<VehicleLoan> = {}): VehicleLoan {
  return {
    id: 'loan-1',
    vehicleId: 'vehicle-1',
    lender: 'HDFC Bank',
    principal: 150_000,
    interestRate: 9.5,
    tenureMonths: 36,
    startDate: '2026-04-05T00:00:00.000Z',
    currencyCode: 'INR',
    emiAmount: 4_800,
    status: LoanStatus.Active,
    closedAt: null,
    createdAt: '2026-04-05T00:00:00.000Z',
    updatedAt: '2026-04-05T00:00:00.000Z',
    totalInterest: 22_800,
    totalPayable: 172_800,
    monthsRemaining: 31,
    outstandingBalance: 131_624,
    interestPaidToDate: 4_200,
    principalPaidToDate: 18_376,
    prepaidToDate: 0,
    endDate: '2029-03-05T00:00:00.000Z',
    prepayments: [],
    ...overrides,
  } as VehicleLoan;
}

describe('LoanPage', () => {
  it('leads with what is left, how far along, and the next EMI', () => {
    loanQuery.current = { isPending: false, isError: false, data: loan() };
    schedule.current = [
      { period: '2026-05', principal: 1, interest: 1, prepayment: 0, balance: 1 },
    ];
    render(<LoanPage loanId="loan-1" />);

    expect(screen.getByRole('heading', { level: 1, name: 'HDFC Bank' })).toBeInTheDocument();
    expect(screen.getByText('Weekend Bike · Active')).toBeInTheDocument();
    const hero = screen.getByTestId('loan-hero');
    expect(hero).toHaveTextContent('₹1,31,624 left');
    expect(hero).toHaveTextContent('12% repaid · ends Mar 2029');
    expect(hero).toHaveTextContent('next EMI ₹4,800 on');
    expect(within(hero).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('button', { name: 'Prepay' })).toBeInTheDocument();
  });

  it('draws the balance with today on it, and the EMI split on demand', async () => {
    loanQuery.current = { isPending: false, isError: false, data: loan() };
    schedule.current = [
      { period: '2026-05', principal: 1, interest: 1, prepayment: 0, balance: 1 },
    ];
    render(<LoanPage loanId="loan-1" />);

    const chart = screen.getByTestId('loan-chart');
    expect(chart).toHaveTextContent('chart: Balance left after each EMI · marker Today');
    await userEvent.click(within(chart).getByRole('radio', { name: 'EMI split' }));
    expect(chart).toHaveTextContent('chart: What each EMI pays, by month');
  });

  it('shows the terms, and offers no prepayment on a closed loan', () => {
    loanQuery.current = {
      isPending: false,
      isError: false,
      data: loan({ status: LoanStatus.Closed, closedAt: '2026-09-01T00:00:00.000Z' }),
    };
    render(<LoanPage loanId="loan-1" />);

    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('9.5% a year')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prepay' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Amount (₹)')).not.toBeInTheDocument();
    expect(screen.getByTestId('loan-hero')).not.toHaveTextContent('next EMI');
  });

  it('tells someone it is not theirs when the API says not found', () => {
    loanQuery.current = {
      isPending: false,
      isError: true,
      error: new ApiError('Not found', 404),
      data: undefined,
    };
    render(<LoanPage loanId="loan-1" />);

    expect(screen.getAllByText('Loan not found')[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Costs' })).toHaveAttribute('href', '/costs');
  });
});

describe('nextEmiDate', () => {
  const active = {
    startDate: '2026-04-05T00:00:00.000Z',
    endDate: '2029-03-05T00:00:00.000Z',
    status: LoanStatus.Active,
  };

  it('is this month when the day has not passed, else next month', () => {
    expect(nextEmiDate(active, new Date(2026, 8, 3))?.getDate()).toBe(5);
    expect(nextEmiDate(active, new Date(2026, 8, 3))?.getMonth()).toBe(8);
    expect(nextEmiDate(active, new Date(2026, 8, 20))?.getMonth()).toBe(9);
  });

  it('is none once the loan has ended or closed', () => {
    expect(nextEmiDate(active, new Date(2029, 5, 1))).toBeNull();
    expect(nextEmiDate({ ...active, status: LoanStatus.Closed }, new Date(2026, 8, 3))).toBeNull();
  });
});

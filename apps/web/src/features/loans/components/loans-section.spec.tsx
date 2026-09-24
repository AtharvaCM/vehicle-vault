import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { VehicleLoan } from '@vehicle-vault/shared';
import { LoanStatus } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

const useLoans = vi.hoisted(() => vi.fn());
const useVehicles = vi.hoisted(() => vi.fn());
const mutationStub = vi.hoisted(() => () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => useVehicles(),
}));

vi.mock('../hooks/use-loans', () => ({
  useLoans: () => useLoans(),
}));
vi.mock('../hooks/use-create-loan', () => ({ useCreateLoan: mutationStub }));
vi.mock('../hooks/use-delete-loan', () => ({ useDeleteLoan: mutationStub }));
vi.mock('../hooks/use-update-loan', () => ({ useUpdateLoan: mutationStub }));
vi.mock('../hooks/use-scan-loan-document', () => ({
  useScanLoanDocument: mutationStub,
  useLoanScanStatus: () => ({ data: { available: false }, isLoading: false }),
}));

import { LoansSection } from './loans-section';

function loan(overrides: Partial<VehicleLoan> = {}): VehicleLoan {
  return {
    id: 'loan-1',
    vehicleId: 'vehicle-1',
    lender: 'HDFC Bank',
    accountNumber: undefined,
    principal: 500_000,
    interestRate: 8.75,
    tenureMonths: 60,
    startDate: '2024-01-01T00:00:00.000Z',
    currencyCode: 'INR',
    notes: undefined,
    emiAmount: 10_275,
    status: LoanStatus.Active,
    closedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    totalInterest: 116_500,
    totalPayable: 616_500,
    monthsRemaining: 40,
    outstandingBalance: 350_000,
    interestPaidToDate: 45_000,
    principalPaidToDate: 150_000,
    prepaidToDate: 0,
    endDate: '2029-01-01T00:00:00.000Z',
    prepayments: [],
    ...overrides,
  };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LoansSection />
    </QueryClientProvider>,
  );
}

describe('LoansSection', () => {
  it('renders the totals and a card per loan', () => {
    useVehicles.mockReturnValue({ data: [], isLoading: false, isError: false });
    useLoans.mockReturnValue({ data: [loan()], isLoading: false, isError: false });

    renderSection();

    expect(screen.getByRole('heading', { name: 'Loans' })).toBeInTheDocument();
    expect(screen.getByText('Monthly EMIs')).toBeInTheDocument();
    expect(screen.getByText('Still owed')).toBeInTheDocument();
    expect(screen.getByText('Interest paid so far')).toBeInTheDocument();
    // Each figure appears twice: once in the totals row, once on the loan's own card.
    expect(screen.getAllByText('₹10,275')).toHaveLength(2);
    expect(screen.getAllByText('₹3,50,000')).toHaveLength(2);
    expect(screen.getAllByText('₹45,000')).toHaveLength(2);
    expect(screen.getByText('HDFC Bank')).toBeInTheDocument();
  });

  it('shows the empty state and no totals when there are no loans', () => {
    useVehicles.mockReturnValue({ data: [], isLoading: false, isError: false });
    useLoans.mockReturnValue({ data: [], isLoading: false, isError: false });

    renderSection();

    expect(screen.getByText('No loans yet')).toBeInTheDocument();
    expect(screen.queryByText('Monthly EMIs')).not.toBeInTheDocument();
  });
});

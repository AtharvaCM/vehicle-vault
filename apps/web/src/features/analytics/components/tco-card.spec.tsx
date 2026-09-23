import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { TcoResponse } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

const getTco = vi.hoisted(() => vi.fn());

vi.mock('../api/get-tco', () => ({
  tcoQueryOptions: (vehicleId: string) => ({
    queryKey: ['tco', vehicleId],
    queryFn: () => getTco(vehicleId),
  }),
}));

import { TcoCard } from './tco-card';

function tco(overrides: Partial<TcoResponse> & { costPerKm?: string | null }): TcoResponse {
  const { costPerKm = '8.07', ...rest } = overrides;
  return {
    currency: 'INR',
    vehicleId: '00000000-0000-4000-8000-000000000001',
    purchaseDate: null,
    purchasePrice: null,
    purchaseOdometer: 15_000,
    ownershipMonths: null,
    kmSincePurchase: 3_500,
    totals: {
      maintenance: '28236.00',
      fuel: '0.00',
      accessories: '0.00',
      insurance: '0.00',
      insurerReimbursed: '0.00',
      loanInterest: '0.00',
      loanPrincipalPaid: '0.00',
      loanOutstanding: '0.00',
      netSpend: '28236.00',
      tco: null,
    },
    derived: { costPerKm, costPerMonth: null },
    ...rest,
  };
}

async function renderCard(data: TcoResponse) {
  getTco.mockResolvedValue(data);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TcoCard vehicleId={data.vehicleId} />
    </QueryClientProvider>,
  );
  await screen.findByText('₹ / km');
}

describe('TcoCard ₹/km', () => {
  it('shows one decimal and the distance it was measured over', async () => {
    await renderCard(tco({}));

    expect(screen.getByText('₹8.1')).toBeInTheDocument();
    expect(screen.getByText('3,500 km')).toBeInTheDocument();
  });

  it('asks for the purchase odometer instead of a figure over too short a distance', async () => {
    await renderCard(tco({ purchaseOdometer: null, kmSincePurchase: 700, costPerKm: null }));

    expect(screen.getByText('Add the odometer at purchase to see cost per km')).toBeInTheDocument();
    expect(screen.queryByText(/700 km/)).not.toBeInTheDocument();
  });

  it('says when a new vehicle has yet to cover enough distance', async () => {
    await renderCard(tco({ purchaseOdometer: 0, kmSincePurchase: 400, costPerKm: null }));

    expect(screen.getByText('400 km so far; shown from 1,000 km')).toBeInTheDocument();
  });
});

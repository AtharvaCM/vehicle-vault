import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import type { TcoResponse, Vehicle } from '@vehicle-vault/shared';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

const getTco = vi.hoisted(() => vi.fn());
const useVehicles = vi.hoisted(() => vi.fn());

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

vi.mock('../api/get-tco', () => ({
  tcoQueryOptions: (vehicleId: string) => ({
    queryKey: ['tco', vehicleId],
    queryFn: () => getTco(vehicleId),
  }),
}));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => useVehicles(),
}));

import { VehicleSpendList } from './vehicle-spend-list';

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    nickname: 'Daily driver',
    make: 'Hyundai',
    model: 'Creta',
    variant: null,
    registrationNumber: 'MH12AB1234',
    fuelType: FuelType.Petrol,
    vehicleType: VehicleType.Car,
    odometer: 45200,
    currentUserRole: 'owner',
    ...overrides,
  } as Vehicle;
}

function tco(overrides: Partial<TcoResponse> & { costPerKm?: string | null } = {}): TcoResponse {
  const { costPerKm = '8.07', ...rest } = overrides;
  return {
    currency: 'INR',
    vehicleId: 'vehicle-1',
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

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VehicleSpendList />
    </QueryClientProvider>,
  );
}

describe('VehicleSpendList', () => {
  it('shows cost per km to one decimal, with the distance it was measured over', async () => {
    useVehicles.mockReturnValue({ data: [vehicle()], isLoading: false, isError: false });
    getTco.mockResolvedValue(tco());

    renderList();

    expect(await screen.findByText('₹8.1')).toBeInTheDocument();
    expect(screen.getByText('3,500 km')).toBeInTheDocument();
    expect(screen.getByText('₹28,236')).toBeInTheDocument();
  });

  it('shows the #192 prompt instead of a ₹/km figure when the distance is too short', async () => {
    useVehicles.mockReturnValue({ data: [vehicle()], isLoading: false, isError: false });
    getTco.mockResolvedValue(tco({ purchaseOdometer: 0, kmSincePurchase: 400, costPerKm: null }));

    renderList();

    expect(await screen.findByText('400 km so far; shown from 1,000 km')).toBeInTheDocument();
    // Never a wrong ₹/km number — the value cell reads empty, not "0.0".
    expect(screen.queryByText('/ km')).not.toBeInTheDocument();
  });

  it('keeps one vehicle row failing to load from breaking the others', async () => {
    useVehicles.mockReturnValue({
      data: [vehicle({ id: 'vehicle-1' }), vehicle({ id: 'vehicle-2', nickname: 'Weekend bike' })],
      isLoading: false,
      isError: false,
    });
    getTco.mockImplementation((vehicleId: string) =>
      vehicleId === 'vehicle-2' ? Promise.reject(new Error('TCO failed')) : Promise.resolve(tco()),
    );

    renderList();

    expect(await screen.findByText('₹28,236')).toBeInTheDocument();
    expect(await screen.findByText('Spend could not be loaded')).toBeInTheDocument();
  });
});

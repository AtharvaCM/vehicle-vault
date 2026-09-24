import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleRole,
  type HistoryFuelEntry,
  type HistoryOdometerEntry,
  type HistoryPage as HistoryPageData,
  type HistoryServiceEntry,
} from '@vehicle-vault/shared';

import type { HistoryVehicle } from '../components/history-row';

// -- fixtures, defined once: a fresh object per render can start an update loop --

const vehicleA: HistoryVehicle = {
  id: 'vehicle-a',
  nickname: 'Daily',
  make: 'Hyundai',
  model: 'Creta',
  registrationNumber: 'MH12AB1234',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

const vehicleB: HistoryVehicle = {
  id: 'vehicle-b',
  nickname: 'Weekend',
  make: 'Royal Enfield',
  model: 'Classic 350',
  registrationNumber: 'MH14CD5678',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

const ONE_VEHICLE = [vehicleA];
const TWO_VEHICLES = [vehicleA, vehicleB];

const confirmedSeptemberService: HistoryServiceEntry = {
  id: 'record-confirmed',
  vehicleId: 'vehicle-a',
  occurredAt: '2026-09-20T00:00:00.000Z',
  month: '2026-09',
  kind: 'service',
  category: MaintenanceCategory.EngineOil,
  status: MaintenanceRecordStatus.Confirmed,
  workshopName: 'Torque Garage',
  odometer: 18_000,
  totalCost: '4200',
  currencyCode: 'INR',
};

const draftSeptemberService: HistoryServiceEntry = {
  ...confirmedSeptemberService,
  id: 'record-draft',
  occurredAt: '2026-09-18T00:00:00.000Z',
  status: MaintenanceRecordStatus.Draft,
  totalCost: '9999',
};

const septemberFuel: HistoryFuelEntry = {
  id: 'fuel-1',
  vehicleId: 'vehicle-a',
  occurredAt: '2026-09-10T00:00:00.000Z',
  month: '2026-09',
  kind: 'fuel',
  quantity: 30.5,
  location: 'HP Petrol Pump',
  odometer: 17_800,
  totalCost: '1500',
};

const augustOdometer: HistoryOdometerEntry = {
  id: 'odo-1',
  vehicleId: 'vehicle-a',
  occurredAt: '2026-08-05T00:00:00.000Z',
  month: '2026-08',
  kind: 'odometer',
  odometer: 17_000,
  previousOdometer: 16_000,
};

/** September: a confirmed service, a draft (excluded), a fuel fill. August: an odometer reading with no total. */
const TWO_MONTH_PAGE: HistoryPageData = {
  entries: [confirmedSeptemberService, draftSeptemberService, septemberFuel, augustOdometer],
  months: [
    { month: '2026-09', total: '5700.00', draftCount: 1 },
    { month: '2026-08', total: null, draftCount: 0 },
  ],
  draftCount: 1,
  nextCursor: null,
};

const EMPTY_PAGE: HistoryPageData = {
  entries: [],
  months: [],
  draftCount: 0,
  nextCursor: null,
};

// -- mocks --

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

const vehiclesQueryRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const historyQueryRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const useHistoryMock = vi.hoisted(() => vi.fn((..._args: unknown[]) => historyQueryRef.current));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => vehiclesQueryRef.current,
}));
vi.mock('../hooks/use-history', () => ({ useHistory: useHistoryMock }));

import { HistoryPage } from './history-page';

function setQueries({
  vehicles,
  page,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage = vi.fn(),
}: {
  vehicles: HistoryVehicle[];
  page: HistoryPageData;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}) {
  vehiclesQueryRef.current = { data: vehicles, isPending: false, isError: false, refetch: vi.fn() };
  historyQueryRef.current = {
    data: { pages: [page] },
    isPending: false,
    isError: false,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch: vi.fn(),
  };
}

describe('HistoryPage month headers', () => {
  it('names the month, spend and draft count, leaving out the draft from the total', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    const september = within(screen.getByText('September 2026').closest('section')!);
    const septemberTotal = september.getByTestId('history-month-total');
    expect(septemberTotal).toHaveTextContent('Spent ₹5,700');
    expect(septemberTotal).toHaveTextContent('1 draft not counted');

    const august = within(screen.getByText('August 2026').closest('section')!);
    expect(august.getByTestId('history-month-total')).not.toHaveTextContent('Spent');
  });

  it('shows the drafts notice banner when there is a draft', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByTestId('history-drafts')).toHaveTextContent(
      '1 service is a draft. It is marked below and left out of the totals until it is confirmed.',
    );
  });

  it('shows no drafts notice when there are none', () => {
    setQueries({
      vehicles: ONE_VEHICLE,
      page: { ...TWO_MONTH_PAGE, draftCount: 0 },
    });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.queryByTestId('history-drafts')).not.toBeInTheDocument();
  });
});

describe('HistoryPage pagination', () => {
  it('loads older entries when asked', async () => {
    const fetchNextPage = vi.fn();
    const user = userEvent.setup();
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE, hasNextPage: true, fetchNextPage });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    await user.click(screen.getByRole('button', { name: 'Show older entries' }));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('offers no older-entries button when there is no next page', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE, hasNextPage: false });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.queryByRole('button', { name: 'Show older entries' })).not.toBeInTheDocument();
  });
});

describe('HistoryPage filters', () => {
  it('calls onSearchStateChange with the new kind when the toggle changes', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={onSearchStateChange} searchState={{}} />);

    await user.click(screen.getByRole('radio', { name: 'Fuel' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ kind: 'fuel' });
  });

  it('hides the vehicle select for a one-vehicle garage', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.queryByRole('combobox', { name: 'Vehicle' })).not.toBeInTheDocument();
  });

  it('shows the vehicle select for a multi-vehicle garage', () => {
    setQueries({ vehicles: TWO_VEHICLES, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByRole('combobox', { name: 'Vehicle' })).toBeInTheDocument();
  });

  it('drops a vehicle filter from the URL that matches no vehicle before asking for history', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(
      <HistoryPage
        onSearchStateChange={vi.fn()}
        searchState={{ vehicle: '11111111-1111-1111-1111-111111111111' }}
      />,
    );

    const [filters] = useHistoryMock.mock.calls.at(-1)!;
    expect(filters).toEqual({ vehicleId: undefined, kind: undefined });
  });

  it('sends a vehicle filter that does match a vehicle in the garage', () => {
    setQueries({ vehicles: TWO_VEHICLES, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{ vehicle: vehicleB.id }} />);

    const [filters] = useHistoryMock.mock.calls.at(-1)!;
    expect(filters).toEqual({ vehicleId: vehicleB.id, kind: undefined });
  });
});

describe('HistoryPage empty states', () => {
  it('shows "No vehicles yet" for a garage with none', () => {
    setQueries({ vehicles: [], page: EMPTY_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByText('No vehicles yet')).toBeInTheDocument();
  });

  it('shows "Nothing logged yet" for a garage with vehicles but no history', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: EMPTY_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByText('Nothing logged yet')).toBeInTheDocument();
  });

  it('offers to clear filters when a filter leaves nothing to show', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();
    setQueries({ vehicles: ONE_VEHICLE, page: EMPTY_PAGE });

    render(
      <HistoryPage onSearchStateChange={onSearchStateChange} searchState={{ kind: 'fuel' }} />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ vehicle: undefined, kind: undefined });
  });
});

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
const bulkDelete = vi.hoisted(() => vi.fn());
const useHistoryMock = vi.hoisted(() => vi.fn((..._args: unknown[]) => historyQueryRef.current));

vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => vehiclesQueryRef.current,
}));
vi.mock('../hooks/use-history', () => ({ useHistory: useHistoryMock }));
vi.mock('@/features/maintenance/hooks/use-bulk-delete-maintenance-records', () => ({
  useBulkDeleteMaintenanceRecords: () => ({ mutateAsync: bulkDelete, isPending: false }),
}));
vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

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

  it('sums up the year and links the draft waiting longest', () => {
    setQueries({
      vehicles: ONE_VEHICLE,
      page: {
        ...TWO_MONTH_PAGE,
        firstDraftId: 'record-draft',
        year: { year: 2026, serviceCount: 3, serviceSpend: '15200.00' },
      },
    });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    const summary = screen.getByTestId('history-summary');
    expect(summary).toHaveTextContent('₹15,200 on 3 services in 2026 · 1 draft to confirm →');
    expect(screen.getByRole('link', { name: '1 draft to confirm →' })).toHaveAttribute(
      'href',
      '/maintenance-records/$recordId/edit',
    );
  });

  it('says when no service was logged this year, and names no drafts when there are none', () => {
    setQueries({
      vehicles: ONE_VEHICLE,
      page: {
        ...TWO_MONTH_PAGE,
        draftCount: 0,
        year: { year: 2026, serviceCount: 0, serviceSpend: '0.00' },
      },
    });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.getByTestId('history-summary')).toHaveTextContent('No services logged in 2026');
    expect(screen.queryByText(/to confirm/)).not.toBeInTheDocument();
  });

  it('keeps the plain description when the kind filter leaves services out', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: { ...TWO_MONTH_PAGE, draftCount: 0, year: null } });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{ kind: 'fuel' }} />);

    expect(screen.queryByTestId('history-summary')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Every service, fuel fill, odometer reading and accessory across your garage.',
      ),
    ).toBeInTheDocument();
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
    expect(filters).toEqual({ vehicleId: undefined, kind: undefined, search: undefined });
  });

  it('sends a vehicle filter that does match a vehicle in the garage', () => {
    setQueries({ vehicles: TWO_VEHICLES, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{ vehicle: vehicleB.id }} />);

    const [filters] = useHistoryMock.mock.calls.at(-1)!;
    expect(filters).toEqual({ vehicleId: vehicleB.id, kind: undefined, search: undefined });
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

    expect(onSearchStateChange).toHaveBeenCalledWith({
      vehicle: undefined,
      kind: undefined,
      search: undefined,
    });
  });
});

describe('HistoryPage search', () => {
  it('sends the search to the API and keeps it in the URL once typing pauses', async () => {
    const user = userEvent.setup();
    const onSearchStateChange = vi.fn();
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={onSearchStateChange} searchState={{}} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search history' }), 'torque ');

    await vi.waitFor(() => expect(onSearchStateChange).toHaveBeenCalledWith({ search: 'torque' }));
    // One call for the pause, not one per key.
    expect(onSearchStateChange).toHaveBeenCalledTimes(1);
  });

  it('asks the API for what the URL searches, and says so when nothing matches', () => {
    setQueries({ vehicles: ONE_VEHICLE, page: EMPTY_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{ search: 'dashcam' }} />);

    const [filters] = useHistoryMock.mock.calls.at(-1)!;
    expect(filters).toEqual({ vehicleId: undefined, kind: undefined, search: 'dashcam' });
    expect(screen.getByText(/Nothing logged matches “dashcam”/)).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search history' })).toHaveValue('dashcam');
  });
});

describe('HistoryPage select mode', () => {
  it('selects services only, and deletes the selected ones together', async () => {
    const user = userEvent.setup();
    bulkDelete.mockResolvedValueOnce(['record-confirmed']);
    setQueries({ vehicles: ONE_VEHICLE, page: TWO_MONTH_PAGE });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);
    await user.click(screen.getByRole('button', { name: 'Select' }));

    // Two services on screen; the fill and the reading take no checkbox.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    await user.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getByText('1 record selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete selected (1)' }));
    await user.click(screen.getByRole('button', { name: 'Delete 1 record' }));

    expect(bulkDelete).toHaveBeenCalledWith(['record-confirmed']);
    await vi.waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
    expect(screen.getByRole('button', { name: 'Select' })).toBeInTheDocument();
  });

  it('offers no Select to someone who only views the vehicles', () => {
    setQueries({
      vehicles: [{ ...vehicleA, currentUserRole: VehicleRole.Viewer }],
      page: TWO_MONTH_PAGE,
    });

    render(<HistoryPage onSearchStateChange={vi.fn()} searchState={{}} />);

    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
  });
});

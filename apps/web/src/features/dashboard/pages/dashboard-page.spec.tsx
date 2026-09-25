import { fireEvent, screen, within } from '@testing-library/react';
import { FuelType, VehicleRole, VehicleType } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeAttentionCounts, makeAttentionItem, makeSummary, makeVehicle } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import type { DashboardSummary, DashboardVehicleHealth } from '../types/dashboard';

const summary = vi.hoisted(() => ({ current: undefined as unknown as DashboardSummary }));
const garage = vi.hoisted(() => ({ current: [] as unknown[] }));

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
vi.mock('../hooks/use-dashboard-summary', () => ({
  useDashboardSummary: () => ({ isPending: false, isError: false, data: summary.current }),
}));
// The Log menu offers the garage the vehicles list knows about.
vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({
  useVehicles: () => ({ isPending: false, data: garage.current }),
}));
// Beside the point here, and each reaches for data of its own.
vi.mock('../components/costs-summary-line', () => ({ CostsSummaryLine: () => null }));
vi.mock('@/features/pwa/components/install-app-card', () => ({ InstallAppCard: () => null }));

import { DashboardPage } from './dashboard-page';

function asVehicle(vehicle: DashboardVehicleHealth) {
  return {
    id: vehicle.id,
    registrationNumber: vehicle.registrationNumber,
    make: 'Maruti',
    model: 'Swift',
    nickname: vehicle.displayName,
    year: 2023,
    vehicleType: VehicleType.Car,
    fuelType: FuelType.Petrol,
    odometer: vehicle.odometer,
    currentUserRole: vehicle.currentUserRole as VehicleRole,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function showDashboard(
  vehicles: DashboardVehicleHealth[],
  overrides: Partial<DashboardSummary> = {},
  focus?: 'overdue',
) {
  summary.current = makeSummary({
    vehicles,
    vehiclesTotal: vehicles.length,
    totalVehicles: vehicles.length,
    // Something is tracked, so an empty queue reads as "All clear".
    reminderCounts: { overdue: 0, dueToday: 0, upcoming: 1, completed: 0 },
    ...overrides,
  });
  garage.current = vehicles.map(asVehicle);
  renderWithProviders(<DashboardPage onSearchStateChange={vi.fn()} searchState={{ focus }} />);
}

const late = {
  attention: [makeAttentionItem({ id: 'late', title: 'Insurance renewal', urgency: 'overdue' })],
  attentionCounts: makeAttentionCounts({ overdue: 1, thisWeek: 3, urgentVehicles: 2, total: 4 }),
} satisfies Partial<DashboardSummary>;

describe('DashboardPage status', () => {
  it('opens on one status line and the queue, with its filters', () => {
    showDashboard([makeVehicle({ id: 'vehicle-1' }), makeVehicle({ id: 'vehicle-2' })], late);

    expect(screen.getByText('1 late · 3 this week · across 2 vehicles')).toBeInTheDocument();
    const filters = screen.getByRole('navigation', { name: 'Filter what needs attention' });
    expect(within(filters).getByRole('link', { name: /Late\s*1/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument();
    expect(screen.queryByTestId('all-clear')).not.toBeInTheDocument();
  });

  it('is "All clear", naming what comes next, when nothing is late or due this week', () => {
    showDashboard([makeVehicle()], {
      attention: [
        makeAttentionItem({ title: 'Timing belt check', urgency: 'this_month', daysUntilDue: 20 }),
      ],
      attentionCounts: makeAttentionCounts({ thisMonth: 1, total: 1 }),
    });

    const panel = screen.getByTestId('all-clear');
    expect(panel).toHaveTextContent('All clear.');
    expect(panel).toHaveTextContent('Next: Timing belt check');
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Filter what needs attention' }),
    ).not.toBeInTheDocument();
  });

  it('asks for papers or a reminder instead of "All clear" when nothing is tracked', () => {
    showDashboard(
      [
        makeVehicle({
          documents: {
            insurance: { state: 'missing', endDate: null },
            puc: { state: 'missing', endDate: null },
          },
        }),
      ],
      { reminderCounts: { overdue: 0, dueToday: 0, upcoming: 0, completed: 0 } },
    );

    expect(screen.queryByTestId('all-clear')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing is being tracked yet')).toBeInTheDocument();
  });
});

describe('DashboardPage garage', () => {
  it('shows a compact strip for several vehicles', () => {
    showDashboard([
      makeVehicle({
        id: 'vehicle-1',
        displayName: 'Family SUV',
        status: 'overdue',
        overdueCount: 1,
      }),
      makeVehicle({ id: 'vehicle-2', displayName: 'Daily hatch' }),
    ]);

    const chips = within(screen.getByTestId('garage-strip')).getAllByTestId('garage-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('Family SUV');
    expect(chips[0]).toHaveTextContent('1 late');
    expect(chips[1]).toHaveTextContent('All clear');
  });

  it('shows one vehicle as a summary row, its odometer updatable in place', () => {
    showDashboard([makeVehicle({ displayName: 'Commuter', odometer: 15_200 })]);

    const row = screen.getByTestId('vehicle-summary-row');
    expect(row).toHaveTextContent('15,200 km');
    expect(
      within(row).getByRole('button', { name: 'Update odometer for Commuter' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('garage-strip')).not.toBeInTheDocument();
  });
});

describe('DashboardPage logging', () => {
  it('logs from one "Log" menu of five writes', () => {
    showDashboard([makeVehicle({ id: 'vehicle-1', displayName: 'Swift' })]);

    expect(screen.queryByRole('button', { name: 'Log service' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('home-log-button'));
    const menu = screen.getByRole('dialog', { name: 'Log' });
    expect(
      within(menu)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(
      expect.arrayContaining([
        'Log service',
        'Log fuel',
        'Update odometer',
        'Add paper',
        'Add reminder',
      ]),
    );
    expect(within(menu).queryByRole('button', { name: 'Add vehicle' })).not.toBeInTheDocument();

    // One vehicle it could be, so the service form opens straight away.
    fireEvent.click(within(menu).getByRole('button', { name: 'Log service' }));
    expect(screen.getByRole('dialog', { name: 'Log a service' })).toBeInTheDocument();
  });

  it('offers a viewer no Log menu', () => {
    showDashboard([makeVehicle({ id: 'vehicle-1', currentUserRole: 'viewer' })]);

    expect(screen.queryByTestId('home-log-button')).not.toBeInTheDocument();
  });

  it('logs only against the vehicles the user can change', () => {
    showDashboard([
      makeVehicle({ id: 'vehicle-1', displayName: 'Swift' }),
      makeVehicle({
        id: 'vehicle-2',
        displayName: 'Shared bike',
        registrationNumber: 'MH12ZZ0001',
        currentUserRole: 'viewer',
      }),
    ]);

    fireEvent.click(screen.getByTestId('home-log-button'));
    fireEvent.click(screen.getByRole('button', { name: 'Log fuel' }));

    // Only one vehicle can be logged against, so there is nothing to choose.
    expect(screen.queryByText('Which vehicle?')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Log fuel' })).toBeInTheDocument();
  });
});

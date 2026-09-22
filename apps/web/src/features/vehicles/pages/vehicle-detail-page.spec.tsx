import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleRole, VehicleType, type Vehicle } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VehicleDetailSearch } from '../types/vehicle-detail-search';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/use-vehicle', () => ({ useVehicle: () => vehicleQuery.current }));
vi.mock('../hooks/use-delete-vehicle', () => ({
  useDeleteVehicle: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/maintenance/hooks/use-maintenance-records', () => ({
  useMaintenanceRecords: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));
vi.mock('@/features/reminders/hooks/use-vehicle-reminders', () => ({
  useVehicleReminders: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));
vi.mock('@/features/audit/hooks/use-vehicle-audit', () => ({ useVehicleAudit: () => ({}) }));
vi.mock('@/features/vehicle-sharing/hooks/use-sharing', () => ({
  useCurrentUserRole: () => ({ role: null, isLoading: false }),
}));

// Cards that fetch their own data; they hold no write controls of their own.
vi.mock('../components/odometer-forecast-card', () => ({ OdometerForecastCard: () => null }));
vi.mock('../components/odometer-history-card', () => ({ OdometerHistoryCard: () => null }));
vi.mock('../components/service-trend-card', () => ({ ServiceTrendCard: () => null }));
vi.mock('../components/vehicle-summary-card', () => ({ VehicleSummaryCard: () => null }));
// Covered by its own spec, viewer case included.
vi.mock('../components/vehicle-setup-prompt', () => ({ VehicleSetupPrompt: () => null }));
vi.mock('@/features/fuel-logs/components/fuel-economy-card', () => ({
  FuelEconomyCard: () => null,
}));
vi.mock('@/features/analytics/components/tco-card', () => ({ TcoCard: () => null }));
// Covered by its own spec, viewer case included.
vi.mock('@/features/service-baseline/components/service-history-card', () => ({
  ServiceHistoryCard: () => null,
}));

import { VehicleDetailPage } from './vehicle-detail-page';

const vehicle: Vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Bajaj',
  model: 'Pulsar NS 200',
  variant: 'ABS',
  year: 2021,
  vehicleType: VehicleType.Motorcycle,
  fuelType: FuelType.Petrol,
  odometer: 40_000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderAs(role: VehicleRole, searchState: VehicleDetailSearch = {}) {
  vehicleQuery.current = {
    data: { ...vehicle, currentUserRole: role },
    isPending: false,
    isError: false,
  };

  return render(
    <VehicleDetailPage
      onSearchStateChange={vi.fn()}
      searchState={searchState}
      vehicleId="vehicle-1"
    />,
  );
}

async function openActionsMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'More vehicle actions' }));
  // Always present, so it proves the menu opened before asserting an absence.
  await screen.findByRole('menuitem', { name: /download service history/i });
}

describe('VehicleDetailPage roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells a viewer the vehicle is view only', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByText('View only')).toBeInTheDocument();
  });

  it('does not label an editor or owner as view only', () => {
    renderAs(VehicleRole.Editor);
    expect(screen.queryByText('View only')).not.toBeInTheDocument();

    renderAs(VehicleRole.Owner);
    expect(screen.queryByText('View only')).not.toBeInTheDocument();
  });

  it('offers a viewer nothing that the API would refuse', () => {
    renderAs(VehicleRole.Viewer);

    for (const name of [
      'Edit Vehicle',
      'Log Maintenance',
      'Add Reminder',
      'Log',
      'Add',
      'Add first record',
      'Add first reminder',
    ]) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    // Reading stays open to them.
    expect(screen.getAllByRole('link', { name: 'View all' })).toHaveLength(2);
    expect(screen.getByText('No records')).toBeInTheDocument();
  });

  it('keeps the write actions for an editor', () => {
    renderAs(VehicleRole.Editor);

    for (const name of [
      'Edit Vehicle',
      'Log Maintenance',
      'Add Reminder',
      'Log',
      'Add',
      'Add first record',
      'Add first reminder',
    ]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('keeps deleting the vehicle to its owner', async () => {
    renderAs(VehicleRole.Owner);
    await openActionsMenu();

    expect(screen.getByRole('menuitem', { name: /delete vehicle permanently/i })).toBeVisible();
  });

  it('does not offer an editor the owner-only delete', async () => {
    renderAs(VehicleRole.Editor);
    await openActionsMenu();

    expect(screen.queryByText(/delete vehicle permanently/i)).not.toBeInTheDocument();
  });

  it('leaves a viewer the downloads but not the delete', async () => {
    renderAs(VehicleRole.Viewer);
    await openActionsMenu();

    expect(screen.getByRole('menuitem', { name: /download resale report/i })).toBeVisible();
    expect(screen.queryByText(/delete vehicle permanently/i)).not.toBeInTheDocument();
  });

  it('hides the loans tab, which is owner-only, from an editor', () => {
    renderAs(VehicleRole.Editor);
    expect(screen.queryByRole('tab', { name: 'Loans' })).not.toBeInTheDocument();
  });

  it('hides logging a service on the service log tab from a viewer', () => {
    renderAs(VehicleRole.Viewer, { tab: 'maintenance' });

    expect(screen.getByText('Service history')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add first record' })).not.toBeInTheDocument();
  });

  it('keeps logging a service on the service log tab for an editor', () => {
    renderAs(VehicleRole.Editor, { tab: 'maintenance' });

    expect(screen.getByRole('link', { name: 'Log' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add first record' })).toBeInTheDocument();
  });
});

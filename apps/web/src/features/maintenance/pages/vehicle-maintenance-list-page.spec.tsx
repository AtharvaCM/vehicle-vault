import { render, screen } from '@testing-library/react';
import { MaintenanceCategory, VehicleRole, type MaintenanceRecord } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const recordsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

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

vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
vi.mock('../hooks/use-maintenance-records', () => ({
  useMaintenanceRecords: () => recordsQuery.current,
}));
vi.mock('../hooks/use-bulk-delete-maintenance-records', () => ({
  useBulkDeleteMaintenanceRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// Only reachable from Import CSV, which is itself one of the gated controls.
vi.mock('../components/maintenance-import-dialog', () => ({
  MaintenanceImportDialog: () => null,
}));

import { VehicleMaintenanceListPage } from './vehicle-maintenance-list-page';

const record: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  serviceDate: '2026-03-21T00:00:00.000Z',
  odometer: 12_000,
  category: MaintenanceCategory.EngineOil,
  workshopName: 'Torque Garage',
  totalCost: 3_200,
  createdAt: '2026-03-21T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

function renderAs(role: VehicleRole, records: MaintenanceRecord[]) {
  vehicleQuery.current = {
    data: { id: 'vehicle-1', make: 'Bajaj', model: 'Pulsar NS 200', currentUserRole: role },
  };
  recordsQuery.current = { data: records, isPending: false, isError: false };

  return render(
    <VehicleMaintenanceListPage
      onSearchStateChange={vi.fn()}
      searchState={{}}
      vehicleId="vehicle-1"
    />,
  );
}

describe('VehicleMaintenanceListPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s add and import', (role) => {
    renderAs(role, [record]);

    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log service' })).toBeInTheDocument();
  });

  it.each([VehicleRole.Owner, VehicleRole.Editor])('lets an %s select and bulk delete', (role) => {
    renderAs(role, [record]);

    expect(screen.getByRole('button', { name: 'Select all visible' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /select service record torque garage/i }),
    ).toBeInTheDocument();
  });

  it('shows a viewer the history without any way to change it', () => {
    renderAs(VehicleRole.Viewer, [record]);

    // Reading stays open to them.
    expect(screen.getByText('Torque Garage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to vehicle' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select all visible' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('gives a viewer an empty history without an add prompt', () => {
    renderAs(VehicleRole.Viewer, []);

    expect(screen.getByText('No service records yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log your first service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
  });

  it('keeps the empty-state add prompt for an editor', () => {
    renderAs(VehicleRole.Editor, []);

    expect(screen.getByRole('link', { name: 'Log your first service' })).toBeInTheDocument();
  });
});

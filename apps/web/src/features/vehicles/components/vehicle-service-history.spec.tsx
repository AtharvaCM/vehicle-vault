import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  VehicleRole,
  type HistoryPage,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const historyQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const useHistoryMock = vi.hoisted(() => vi.fn((..._args: unknown[]) => historyQuery.current));

vi.mock('@/features/maintenance/hooks/use-upload-first-draft', () => ({
  useUploadFirstDraft: () => ({ canRead: true, isPending: false, onFiles: vi.fn() }),
}));
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
}));
vi.mock('@/features/history/hooks/use-history', () => ({ useHistory: useHistoryMock }));
vi.mock('@/features/maintenance/hooks/use-bulk-delete-maintenance-records', () => ({
  useBulkDeleteMaintenanceRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/maintenance/components/maintenance-import-dialog', () => ({
  MaintenanceImportDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Import service CSV" /> : null,
}));

import { VehicleAccessProvider } from '../context/vehicle-access';
import { VehicleServiceHistory } from './vehicle-service-history';

const vehicle = {
  id: 'vehicle-1',
  nickname: 'Daily',
  make: 'Hyundai',
  model: 'Creta',
  registrationNumber: 'MH12AB1234',
  fuelType: FuelType.Petrol,
  currentUserRole: VehicleRole.Owner,
};

const page: HistoryPage = {
  entries: [
    {
      kind: 'service',
      id: 'record-1',
      vehicleId: 'vehicle-1',
      occurredAt: '2026-09-20T00:00:00.000Z',
      month: '2026-09',
      category: MaintenanceCategory.EngineOil,
      status: MaintenanceRecordStatus.Confirmed,
      workshopName: 'Torque Garage',
      odometer: 18_000,
      totalCost: '4200',
      currencyCode: 'INR',
    },
  ],
  months: [{ month: '2026-09', total: '4200.00', draftCount: 0 }],
  draftCount: 0,
  nextCursor: null,
};
const emptyPage: HistoryPage = { entries: [], months: [], draftCount: 0, nextCursor: null };

function settle(data: HistoryPage) {
  historyQuery.current = {
    data: { pages: [data] },
    isPending: false,
    isError: false,
    hasNextPage: false,
    refetch: vi.fn(),
  };
}

function renderAs(role: VehicleRole, search?: string, onSearchChange = vi.fn()) {
  return render(
    <VehicleAccessProvider role={role}>
      <VehicleServiceHistory onSearchChange={onSearchChange} search={search} vehicle={vehicle} />
    </VehicleAccessProvider>,
  );
}

describe('VehicleServiceHistory', () => {
  beforeEach(() => {
    settle(page);
  });

  it("lists this vehicle's services through the History list", () => {
    renderAs(VehicleRole.Owner, 'oil');

    expect(useHistoryMock).toHaveBeenLastCalledWith({
      vehicleId: 'vehicle-1',
      kind: 'service',
      search: 'oil',
    });
    expect(screen.getByTestId('history-row')).toHaveTextContent('Engine oil');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('gives an editor search, Select and Import CSV', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Editor);

    expect(screen.getByRole('searchbox', { name: 'Search history' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.getByRole('checkbox', { name: /Select Engine oil/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import CSV' }));
    expect(screen.getByRole('dialog', { name: 'Import service CSV' })).toBeInTheDocument();
  });

  it('gives a viewer search only', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.getByRole('searchbox', { name: 'Search history' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
  });

  it('offers the bill first, then import and the first service, on an empty log', () => {
    settle(emptyPage);
    renderAs(VehicleRole.Owner);

    expect(screen.getByText('No service records yet')).toBeInTheDocument();
    const snap = screen.getByRole('button', { name: 'Snap the bill' });
    const byHand = screen.getByRole('link', { name: 'Log your first service' });
    expect(snap.compareDocumentPosition(byHand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log your first service' })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('says when a search finds nothing, and clears it', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    settle(emptyPage);
    renderAs(VehicleRole.Owner, 'dashcam', onSearchChange);

    expect(screen.getByText(/No service on this vehicle matches “dashcam”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onSearchChange).toHaveBeenCalledWith(undefined);
  });
});

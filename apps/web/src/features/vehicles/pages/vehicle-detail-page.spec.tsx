import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleRole, VehicleType, type Vehicle } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

import type { VehicleDetailSearch } from '../types/vehicle-detail-search';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const documents = vi.hoisted(() => ({ current: [] as unknown[] }));

vi.mock('@/features/maintenance/hooks/use-upload-first-draft', () => ({
  useUploadFirstDraft: () => ({ canRead: true, isPending: false, onFiles: vi.fn() }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to: string;
  }) => (
    <a
      data-params={params ? JSON.stringify(params) : undefined}
      data-search={search ? JSON.stringify(search) : undefined}
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock('../hooks/use-vehicle', () => ({ useVehicle: () => vehicleQuery.current }));
vi.mock('../hooks/use-delete-vehicle', () => ({
  useDeleteVehicle: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/history/hooks/use-history', () => ({
  useHistory: () => ({
    data: { pages: [] },
    isPending: false,
    isError: false,
    hasNextPage: false,
  }),
}));
vi.mock('@/features/maintenance/hooks/use-maintenance-records', () => ({
  useMaintenanceRecords: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));
vi.mock('@/features/maintenance/hooks/use-bulk-delete-maintenance-records', () => ({
  useBulkDeleteMaintenanceRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/reminders/hooks/use-vehicle-reminders', () => ({
  useVehicleReminders: () => ({ data: [], isPending: false, isError: false, isSuccess: true }),
}));
vi.mock('@/features/reminders/hooks/use-bulk-complete-reminders', () => ({
  useBulkCompleteReminders: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/reminders/hooks/use-bulk-delete-reminders', () => ({
  useBulkDeleteReminders: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/vehicle-documents/hooks/use-documents', () => ({
  useVehicleDocuments: () => ({ data: documents.current, isPending: false, isError: false }),
}));
vi.mock('@/features/audit/hooks/use-vehicle-audit', () => ({ useVehicleAudit: () => ({}) }));
vi.mock('@/features/vehicle-sharing/hooks/use-sharing', () => ({
  useCurrentUserRole: () => ({ role: null, isLoading: false }),
}));

// Cards that fetch their own data; they hold no write controls of their own.
vi.mock('../components/odometer-history-card', () => ({ OdometerHistoryCard: () => null }));
// Covered by its own spec, viewer case included.
vi.mock('../components/vehicle-setup-prompt', () => ({ VehicleSetupPrompt: () => null }));
// Its own spec covers it; here only which tab is showing matters.
vi.mock('../components/vehicle-overview', () => ({
  VehicleOverview: () => <p>vehicle overview</p>,
}));
vi.mock('@/features/fuel-logs/components/fuel-economy-card', () => ({
  FuelEconomyCard: () => null,
}));
vi.mock('@/features/analytics/components/tco-card', () => ({ TcoCard: () => null }));
// Covered by its own spec, viewer case included.
vi.mock('@/features/service-baseline/components/service-history-card', () => ({
  ServiceHistoryCard: () => null,
}));
vi.mock('@/features/reminders/components/service-schedule-panel', () => ({
  ServiceSchedulePanel: () => <p>Suggested service schedule</p>,
}));
// The Log menu's dialogs save through React Query; only whether they are offered is tested here.
vi.mock('@/features/dashboard/components/fuel-log-dialog', () => ({
  FuelLogDialog: () => null,
}));
vi.mock('@/features/vehicle-documents/components/document-form-dialog', () => ({
  DocumentFormDialog: () => null,
}));
vi.mock('@/features/maintenance/components/maintenance-import-dialog', () => ({
  MaintenanceImportDialog: () => null,
}));
vi.mock('@/features/maintenance/hooks/use-bulk-delete-maintenance-records', () => ({
  useBulkDeleteMaintenanceRecords: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/features/loans/components/vehicle-loans-panel', () => ({
  VehicleLoansPanel: () => <p>Loans panel</p>,
}));
vi.mock('@/features/vehicle-sharing/components/members-tab', () => ({
  MembersTab: () => <p>Members panel</p>,
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

function paper(kind: string, endDate: string) {
  return {
    id: `${kind}-1`,
    vehicleId: 'vehicle-1',
    kind,
    provider: 'Issuer',
    startDate: new Date('2025-01-01T00:00:00.000Z'),
    endDate: new Date(endDate),
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };
}

function renderAs(
  role: VehicleRole,
  searchState: VehicleDetailSearch = {},
  onSearchStateChange = vi.fn(),
) {
  vehicleQuery.current = {
    data: { ...vehicle, currentUserRole: role },
    isPending: false,
    isError: false,
  };

  return render(
    <VehicleDetailPage
      onSearchStateChange={onSearchStateChange}
      searchState={searchState}
      vehicleId="vehicle-1"
    />,
  );
}

async function openMenu(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name }));
  // Every menu has at least one item, so this proves it opened before asserting an absence.
  await screen.findAllByRole('menuitem');
}

describe('VehicleDetailPage header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents.current = [];
  });

  it('names the vehicle by its plate, nickname, model and odometer', () => {
    renderAs(VehicleRole.Owner);

    expect(screen.getByRole('heading', { level: 1, name: 'Bajaj Pulsar NS 200' })).toBeVisible();
    expect(screen.getByText(/40,000 km, updated/)).toBeVisible();
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

  it('offers an editor every kind of log from one menu', async () => {
    renderAs(VehicleRole.Editor);
    await openMenu('Log');

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Service',
      'Fuel',
      'Odometer',
      'Paper',
      'Accessory',
      'Reminder',
    ]);
  });

  it('offers a viewer nothing that the API would refuse', async () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByRole('button', { name: 'Log' })).not.toBeInTheDocument();
    for (const name of ['Edit vehicle', 'Log', 'Add', 'Add first record', 'Add first reminder']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    // Reading stays open to them.
    expect(screen.getByRole('link', { name: 'Show papers' })).toBeVisible();

    await openMenu('More vehicle actions');
    expect(screen.getByRole('menuitem', { name: /download service history/i })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: /download resale report/i })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Edit vehicle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete vehicle' })).not.toBeInTheDocument();
  });

  it('keeps editing to an editor and deleting to the owner', async () => {
    renderAs(VehicleRole.Editor);
    await openMenu('More vehicle actions');
    expect(screen.getByRole('menuitem', { name: 'Edit vehicle' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Delete vehicle' })).not.toBeInTheDocument();
  });

  it('offers the owner Delete vehicle', async () => {
    renderAs(VehicleRole.Owner);
    await openMenu('More vehicle actions');

    expect(screen.getByRole('menuitem', { name: 'Delete vehicle' })).toBeVisible();
  });

  it('opens every paper in one view from Show papers', () => {
    documents.current = [paper('puc', '2027-01-01T00:00:00.000Z')];
    renderAs(VehicleRole.Viewer);

    const link = screen.getByRole('link', { name: 'Show papers' });
    expect(link).toHaveAttribute('href', '/vehicles/$vehicleId/papers');
    expect(link).toHaveAttribute('data-params', JSON.stringify({ vehicleId: 'vehicle-1' }));
  });

  it('opens the Papers tab from Show papers when none is on file', () => {
    renderAs(VehicleRole.Owner);

    expect(screen.getByRole('link', { name: 'Show papers' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'papers' }),
    );
  });
});

describe('VehicleDetailPage tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents.current = [];
  });

  it('has five tabs, for every role', () => {
    for (const role of [VehicleRole.Owner, VehicleRole.Viewer]) {
      const { unmount } = renderAs(role);
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
        'Overview',
        'History',
        'Reminders',
        'Papers',
        'More',
      ]);
      unmount();
    }
  });

  it('switches tab through the search state', async () => {
    const onSearchStateChange = vi.fn();
    renderAs(VehicleRole.Owner, {}, onSearchStateChange);

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Papers' }));

    expect(onSearchStateChange).toHaveBeenCalledWith({ tab: 'papers' });
  });

  it('marks Papers, in words for a screen reader, when a paper has expired', () => {
    documents.current = [paper('insurance', '2026-01-01T00:00:00.000Z')];
    renderAs(VehicleRole.Viewer);

    const tab = screen.getByRole('tab', { name: 'Papers, 1 paper expired' });
    expect(within(tab).getByTestId('papers-status-dot')).toHaveAttribute('data-tone', 'late');
  });

  it('leaves Papers unmarked when every paper is in date', () => {
    documents.current = [paper('insurance', '2099-01-01T00:00:00.000Z')];
    renderAs(VehicleRole.Viewer);

    expect(screen.getByRole('tab', { name: 'Papers' })).toBeVisible();
    expect(screen.queryByTestId('papers-status-dot')).not.toBeInTheDocument();
  });

  it('shows the service log under History, without logging for a viewer', () => {
    renderAs(VehicleRole.Viewer, { tab: 'history' });

    expect(screen.getByText('No service records yet')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Service' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Import CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log your first service' })).not.toBeInTheDocument();
  });

  it('keeps logging a service under History for an editor', () => {
    renderAs(VehicleRole.Editor, { tab: 'history' });

    expect(screen.getAllByRole('button', { name: 'Import CSV' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Log your first service' })).toBeInTheDocument();
  });

  it('adds the suggested service schedule to Reminders', () => {
    renderAs(VehicleRole.Owner, { tab: 'reminders' });

    expect(screen.getByText('Suggested service schedule')).toBeVisible();
  });

  it('lists the sections under More, with Loans for the owner only', () => {
    renderAs(VehicleRole.Owner, { tab: 'more' });
    const owned = within(screen.getByRole('navigation', { name: 'More about this vehicle' }));
    expect(owned.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'About this vehicleVariant, key specs and when you bought it',
      'TyresTread, age and rotation',
      "LoansEMIs and what's left to pay",
      'MembersWho can see this vehicle or log for it',
      'ActivityEvery change, in words, newest first',
    ]);
    expect(owned.getByRole('link', { name: /^Tyres/ })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'more', section: 'tyres' }),
    );
  });

  it('keeps Loans off the More list for an editor', () => {
    renderAs(VehicleRole.Editor, { tab: 'more' });

    expect(screen.queryByRole('link', { name: /^Loans/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Members/ })).toBeVisible();
  });

  it('opens a More section with a way back to the list', () => {
    renderAs(VehicleRole.Owner, { tab: 'more', section: 'loans' });

    expect(screen.getByRole('heading', { name: 'Loans' })).toBeVisible();
    expect(screen.getByText('Loans panel')).toBeVisible();
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute(
      'data-search',
      JSON.stringify({ tab: 'more' }),
    );
  });

  it('sends an editor who opens Loans back to the More list', () => {
    const onSearchStateChange = vi.fn();
    renderAs(VehicleRole.Editor, { tab: 'more', section: 'loans' }, onSearchStateChange);

    expect(screen.queryByText('Loans panel')).not.toBeInTheDocument();
    expect(onSearchStateChange).toHaveBeenCalledWith({ tab: 'more', section: undefined });
  });
});

function renderErrored(error: unknown, extra: Record<string, unknown> = {}) {
  const refetch = vi.fn();
  vehicleQuery.current = { isPending: false, isError: true, error, refetch, ...extra };

  render(
    <VehicleDetailPage onSearchStateChange={vi.fn()} searchState={{}} vehicleId="vehicle-1" />,
  );

  return { refetch };
}

describe('VehicleDetailPage errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells a malformed or unknown vehicle id apart from a real failure', () => {
    renderErrored(new ApiError('Vehicle not found', 404));

    expect(screen.getByText("This vehicle isn't in your garage.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your garage' })).toHaveAttribute('href', '/garage');
  });

  it('tells a viewer whose access was removed why, not just that it failed', () => {
    renderErrored(new ApiError('Forbidden', 403));

    expect(
      screen.getByText('You no longer have access — the owner may have removed you.'),
    ).toBeInTheDocument();
  });

  it('offers a working Try again that refetches on a network/5xx failure', () => {
    const { refetch } = renderErrored(new ApiError('Internal error', 500));

    expect(screen.getByText("We couldn't load this vehicle.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

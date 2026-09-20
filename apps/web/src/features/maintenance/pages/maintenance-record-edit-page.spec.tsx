import { render, screen } from '@testing-library/react';
import { MaintenanceCategory, VehicleRole, type MaintenanceRecord } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const recordQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

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

vi.mock('../hooks/use-maintenance-record', () => ({
  useMaintenanceRecord: () => recordQuery.current,
}));
vi.mock('../hooks/use-update-maintenance-record', () => ({
  useUpdateMaintenanceRecord: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/maintenance-form', () => ({
  MaintenanceForm: () => <div>maintenance form</div>,
}));
// Cards that fetch their own data; a viewer never reaches them here.
vi.mock('../components/maintenance-draft-review-card', () => ({
  MaintenanceDraftReviewCard: () => null,
}));
vi.mock('@/features/claims/components/maintenance-claim-link-card', () => ({
  MaintenanceClaimLinkCard: () => null,
}));
vi.mock('@/features/attachments/components/attachments-section', () => ({
  AttachmentsSection: () => null,
}));

import { MaintenanceRecordEditPage } from './maintenance-record-edit-page';

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

function renderAs(role: VehicleRole) {
  recordQuery.current = { data: record, isPending: false, isError: false };
  vehicleQuery.current = { data: { id: 'vehicle-1', currentUserRole: role } };

  return render(<MaintenanceRecordEditPage recordId="record-1" />);
}

describe('MaintenanceRecordEditPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByText('maintenance form')).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('maintenance form')).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Record' })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { VehicleRole } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false, error: null }));

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
vi.mock('../hooks/use-create-maintenance-record', () => ({ useCreateMaintenanceRecord: mutation }));
vi.mock('../hooks/use-create-maintenance-draft', () => ({ useCreateMaintenanceDraft: mutation }));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => ({ data: { available: true } }),
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/maintenance-form', () => ({
  MaintenanceForm: () => <div>maintenance form</div>,
}));
vi.mock('@/features/claims/components/maintenance-claim-link-card', () => ({
  MaintenanceClaimLinkCard: () => null,
}));

import { VehicleMaintenanceCreatePage } from './vehicle-maintenance-create-page';

function renderAs(role: VehicleRole) {
  vehicleQuery.current = {
    data: { id: 'vehicle-1', make: 'Bajaj', model: 'Pulsar NS 200', currentUserRole: role },
    isError: false,
  };

  return render(<VehicleMaintenanceCreatePage vehicleId="vehicle-1" />);
}

describe('VehicleMaintenanceCreatePage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByText('maintenance form')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload job card first/i })).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('maintenance form')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /upload job card first/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Maintenance History' })).toBeInTheDocument();
  });
});

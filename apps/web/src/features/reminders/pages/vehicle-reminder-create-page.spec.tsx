import { render, screen } from '@testing-library/react';
import { VehicleRole } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => vehicleQuery.current,
}));
vi.mock('../hooks/use-create-reminder', () => ({
  useCreateReminder: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/reminder-form', () => ({ ReminderForm: () => <div>reminder form</div> }));

import { VehicleReminderCreatePage } from './vehicle-reminder-create-page';

function renderAs(role: VehicleRole) {
  vehicleQuery.current = {
    data: { id: 'vehicle-1', make: 'Bajaj', model: 'Pulsar NS 200', currentUserRole: role },
    isError: false,
  };

  return render(<VehicleReminderCreatePage vehicleId="vehicle-1" />);
}

describe('VehicleReminderCreatePage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByText('reminder form')).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('reminder form')).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Reminders' })).toBeInTheDocument();
  });
});

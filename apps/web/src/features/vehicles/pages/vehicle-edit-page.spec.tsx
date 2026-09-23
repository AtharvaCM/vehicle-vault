import { render, screen } from '@testing-library/react';
import { FuelType, VehicleRole, VehicleType, type Vehicle } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

const vehicleQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const vehicleFormProps = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
}));

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
vi.mock('../hooks/use-update-vehicle', () => ({
  useUpdateVehicle: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));
// Pulls in the router module, which the router mock above does not build.
vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));
vi.mock('../components/vehicle-form', () => ({
  VehicleForm: (props: Record<string, unknown>) => {
    vehicleFormProps.current = props;
    return <div>vehicle form</div>;
  },
}));

import { VehicleEditPage } from './vehicle-edit-page';

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
  purchaseDate: '2021-03-15T00:00:00.000Z',
  purchasePrice: 145_000,
  purchaseOdometer: 0,
};

function renderAs(role: VehicleRole) {
  vehicleQuery.current = {
    data: { ...vehicle, currentUserRole: role },
    isPending: false,
    isError: false,
  };

  return render(<VehicleEditPage vehicleId="vehicle-1" />);
}

describe('VehicleEditPage roles', () => {
  it.each([VehicleRole.Owner, VehicleRole.Editor])('gives an %s the form', (role) => {
    renderAs(role);

    expect(screen.getByText('vehicle form')).toBeInTheDocument();
    expect(screen.queryByText('You have view-only access')).not.toBeInTheDocument();
  });

  it('replaces the form with an explanation for a viewer', () => {
    renderAs(VehicleRole.Viewer);

    expect(screen.queryByText('vehicle form')).not.toBeInTheDocument();
    expect(screen.getByText('You have view-only access')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Vehicle' })).toBeInTheDocument();
  });
});

describe('VehicleEditPage prefill', () => {
  it('prefills the saved purchase date, price and odometer, and submits in edit mode', () => {
    renderAs(VehicleRole.Owner);

    expect(vehicleFormProps.current?.mode).toBe('edit');
    expect(vehicleFormProps.current?.initialValues).toMatchObject({
      // Sliced to a bare date: a full ISO instant fails the date input's
      // sanitization and would render blank instead of prefilled.
      purchaseDate: '2021-03-15',
      purchasePrice: 145_000,
      purchaseOdometer: 0,
    });
  });
});

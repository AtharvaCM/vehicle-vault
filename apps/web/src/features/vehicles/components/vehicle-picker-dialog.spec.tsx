import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { VehiclePickerDialog, type VehiclePickerVehicle } from './vehicle-picker-dialog';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    to?: string;
  }) => (
    <a data-params={params ? JSON.stringify(params) : undefined} href={to} {...props}>
      {children}
    </a>
  ),
}));

const buildLink = (vehicleId: string) =>
  ({ to: '/vehicles/$vehicleId/maintenance/new', params: { vehicleId } }) as never;

function makeVehicle(overrides: Partial<VehiclePickerVehicle> = {}): VehiclePickerVehicle {
  return {
    id: 'vehicle-1',
    nickname: 'Daily driver',
    make: 'Hyundai',
    model: 'Creta',
    registrationNumber: 'MH12AB1234',
    currentUserRole: 'owner',
    ...overrides,
  };
}

describe('VehiclePickerDialog', () => {
  it('shows a disabled trigger while the vehicles query is still loading, never "Add vehicle"', () => {
    // `vehicles` is `[]` here for the same reason it is on a real page while
    // the query is pending — not because the account has none.
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        isLoading
        triggerLabel="Log maintenance"
        vehicles={[]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Log maintenance' });
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers to add a vehicle when there are none editable', () => {
    render(
      <VehiclePickerDialog
        addVehicleLabel="Add your first vehicle"
        buildLink={buildLink}
        triggerLabel="Log maintenance"
        vehicles={[]}
      />,
    );

    const link = screen.getByRole('link', { name: 'Add your first vehicle' });
    expect(link).toHaveAttribute('href', '/vehicles/new');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('treats an account with only a viewer-role vehicle as having none editable', () => {
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        triggerLabel="Log maintenance"
        vehicles={[makeVehicle({ currentUserRole: 'viewer' })]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Add vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/new',
    );
  });

  it('links straight to the only editable vehicle, skipping the dialog', () => {
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        triggerLabel="Log maintenance"
        vehicles={[makeVehicle({ id: 'vehicle-1' })]}
      />,
    );

    const link = screen.getByRole('link', { name: 'Log maintenance' });
    expect(link).toHaveAttribute('href', '/vehicles/$vehicleId/maintenance/new');
    expect(link).toHaveAttribute('data-params', JSON.stringify({ vehicleId: 'vehicle-1' }));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('skips a viewer-only vehicle even when it would otherwise be the only one', () => {
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        triggerLabel="Log maintenance"
        vehicles={[
          makeVehicle({ id: 'vehicle-1', currentUserRole: 'owner' }),
          makeVehicle({ id: 'vehicle-2', nickname: 'Viewer bike', currentUserRole: 'viewer' }),
        ]}
      />,
    );

    const link = screen.getByRole('link', { name: 'Log maintenance' });
    expect(link).toHaveAttribute('data-params', JSON.stringify({ vehicleId: 'vehicle-1' }));
  });

  it('opens a dialog listing every editable vehicle when there are several', () => {
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        dialogTitle="Log maintenance"
        triggerLabel="Log maintenance"
        vehicles={[
          makeVehicle({ id: 'vehicle-1', nickname: 'Daily driver', currentUserRole: 'owner' }),
          makeVehicle({ id: 'vehicle-2', nickname: 'Weekend bike', currentUserRole: 'editor' }),
          makeVehicle({ id: 'vehicle-3', nickname: 'Shared car', currentUserRole: 'viewer' }),
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Log maintenance' });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Log maintenance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Daily driver/ })).toHaveAttribute(
      'data-params',
      JSON.stringify({ vehicleId: 'vehicle-1' }),
    );
    expect(screen.getByRole('link', { name: /Weekend bike/ })).toHaveAttribute(
      'data-params',
      JSON.stringify({ vehicleId: 'vehicle-2' }),
    );
    // The viewer-only vehicle never appears in the list.
    expect(screen.queryByText('Shared car')).not.toBeInTheDocument();
  });

  it('closes the dialog after a vehicle is chosen', () => {
    render(
      <VehiclePickerDialog
        buildLink={buildLink}
        triggerLabel="Log maintenance"
        vehicles={[
          makeVehicle({ id: 'vehicle-1', nickname: 'Daily driver' }),
          makeVehicle({ id: 'vehicle-2', nickname: 'Weekend bike' }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Log maintenance' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Daily driver/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

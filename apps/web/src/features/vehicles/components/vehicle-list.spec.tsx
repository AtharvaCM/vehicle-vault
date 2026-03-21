import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { FuelType, VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { VehicleList } from './vehicle-list';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Honda',
  model: 'City',
  variant: 'VX',
  year: 2022,
  fuelType: FuelType.Petrol,
  odometer: 15400,
  vehicleType: VehicleType.Car,
  nickname: 'Daily driver',
  createdAt: '2026-03-21T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

describe('VehicleList', () => {
  it('renders selection checkboxes and reports selection changes', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();

    render(
      <VehicleList
        onSelectionChange={onSelectionChange}
        selectedVehicleIds={[]}
        vehicles={[vehicle]}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /select vehicle daily driver/i }));

    expect(onSelectionChange).toHaveBeenCalledWith('vehicle-1', true);
  });

  it('reflects controlled selection state', () => {
    render(
      <VehicleList
        onSelectionChange={vi.fn()}
        selectedVehicleIds={['vehicle-1']}
        vehicles={[vehicle]}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /select vehicle daily driver/i })).toBeChecked();
  });
});

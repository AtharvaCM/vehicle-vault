import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type AnchorHTMLAttributes } from 'react';
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
  it("offers each vehicle's papers in one tap, beside the link to the vehicle", () => {
    render(<VehicleList vehicles={[vehicle]} />);

    // The mocked Link renders no href, so it is found by its name rather than as a link.
    const papers = screen.getByLabelText('Show papers for Daily driver');
    expect(papers).toHaveAttribute('to', '/vehicles/$vehicleId/papers');
    // Not a link inside a link, which a browser would take apart.
    expect(papers.parentElement?.closest('a')).toBeNull();
  });

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

  it('stays visually checked after a click, round-tripped through selection state', async () => {
    const user = userEvent.setup();

    function ControlledVehicleList() {
      const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

      return (
        <VehicleList
          onSelectionChange={(vehicleId, checked) =>
            setSelectedVehicleIds((current) =>
              checked ? [...current, vehicleId] : current.filter((id) => id !== vehicleId),
            )
          }
          selectedVehicleIds={selectedVehicleIds}
          vehicles={[vehicle]}
        />
      );
    }

    render(<ControlledVehicleList />);

    const checkbox = screen.getByRole('checkbox', { name: /select vehicle daily driver/i });
    await user.click(checkbox);

    // A regression here means the wrapping label reverted the native toggle
    // even though selection state (and the callback) updated correctly.
    expect(checkbox).toBeChecked();
  });

  it('gives a selected vehicle card a visible selected style', () => {
    const { container } = render(
      <VehicleList
        onSelectionChange={vi.fn()}
        selectedVehicleIds={['vehicle-1']}
        vehicles={[vehicle]}
      />,
    );

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass('ring-2', 'ring-primary');
  });

  it('leaves an unselected vehicle card without the selected style', () => {
    const { container } = render(
      <VehicleList onSelectionChange={vi.fn()} selectedVehicleIds={[]} vehicles={[vehicle]} />,
    );

    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toHaveClass('ring-2');
  });

  it('names each vehicle with an S plate, its registration spaced as it prints', () => {
    const { container } = render(
      <VehicleList onSelectionChange={vi.fn()} selectedVehicleIds={[]} vehicles={[vehicle]} />,
    );

    expect(screen.getByText('MH 12 AB 1234')).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="number-plate"][data-size="sm"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText('MH12AB1234')).not.toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.hoisted(() => vi.fn());
const vehicles = vi.hoisted(() => ({ data: [] as unknown[], isPending: false }));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@/features/vehicles/hooks/use-vehicles', () => ({ useVehicles: () => vehicles }));
vi.mock('@/features/dashboard/components/quick-log-dialog', () => ({
  QuickLogDialog: ({ vehicles: picked }: { vehicles: Array<{ id: string }> }) => (
    <div role="dialog" aria-label="Log a service">
      service for {picked.map((vehicle) => vehicle.id).join(',')}
    </div>
  ),
}));
vi.mock('@/features/dashboard/components/fuel-log-dialog', () => ({
  FuelLogDialog: ({ vehicles: picked }: { vehicles: Array<{ id: string }> }) => (
    <div role="dialog" aria-label="Log fuel">
      fuel for {picked.map((vehicle) => vehicle.id).join(',')}
    </div>
  ),
}));
vi.mock('@/features/dashboard/components/odometer-update-form', () => ({
  OdometerUpdateForm: ({ vehicleId }: { vehicleId: string }) => <p>odometer for {vehicleId}</p>,
}));
vi.mock('@/features/vehicle-documents/components/document-form-dialog', () => ({
  DocumentFormDialog: ({ vehicleId }: { vehicleId: string }) => (
    <div role="dialog" aria-label="Add paper">
      paper for {vehicleId}
    </div>
  ),
}));

import { QuickLogButton } from './quick-log';

function vehicle(id: string, nickname: string, currentUserRole = 'owner') {
  return {
    id,
    nickname,
    make: 'Hyundai',
    model: 'Creta',
    registrationNumber: `MH12${id}`,
    odometer: 1000,
    fuelType: 'petrol',
    currentUserRole,
  };
}

async function openSheet() {
  const user = userEvent.setup();
  render(<QuickLogButton />);
  await user.click(screen.getByRole('button', { name: 'Log' }));
  return { user, sheet: await screen.findByRole('dialog', { name: 'Log' }) };
}

describe('QuickLogButton', () => {
  beforeEach(() => {
    navigate.mockClear();
    vehicles.data = [vehicle('v1', 'Family SUV')];
    vehicles.isPending = false;
  });

  it('offers the six quick writes', async () => {
    const { sheet } = await openSheet();

    expect(
      within(sheet)
        .getAllByRole('button')
        .map((button) => button.textContent)
        .filter((text) => text !== 'Close'),
    ).toEqual([
      'Log service',
      'Log fuel',
      'Update odometer',
      'Add paper',
      'Add reminder',
      'Add vehicle',
    ]);
  });

  it('skips the vehicle question when there is only one vehicle', async () => {
    const { user, sheet } = await openSheet();

    await user.click(within(sheet).getByRole('button', { name: 'Log fuel' }));

    expect(await screen.findByRole('dialog', { name: 'Log fuel' })).toHaveTextContent(
      'fuel for v1',
    );
  });

  it('asks which vehicle first when there are several, leaving out view-only ones', async () => {
    vehicles.data = [
      vehicle('v2', 'Weekend Bike'),
      vehicle('v1', 'Family SUV'),
      vehicle('v3', 'Shared Car', 'viewer'),
    ];
    const { user, sheet } = await openSheet();

    await user.click(within(sheet).getByRole('button', { name: 'Add paper' }));

    const picker = await screen.findByRole('dialog', { name: 'Which vehicle?' });
    const choices = within(within(picker).getByRole('list', { name: 'Vehicles' })).getAllByRole(
      'button',
    );
    expect(choices.map((choice) => choice.textContent)).toEqual([
      expect.stringContaining('Family SUV'),
      expect.stringContaining('Weekend Bike'),
    ]);

    await user.click(choices[1]!);
    expect(await screen.findByRole('dialog', { name: 'Add paper' })).toHaveTextContent(
      'paper for v2',
    );
  });

  it('goes to the reminder form for the chosen vehicle, and to Add vehicle', async () => {
    const { user, sheet } = await openSheet();

    await user.click(within(sheet).getByRole('button', { name: 'Add reminder' }));
    expect(navigate).toHaveBeenCalledWith({
      to: '/vehicles/$vehicleId/reminders/new',
      params: { vehicleId: 'v1' },
    });

    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Log' })).getByRole('button', {
        name: 'Add vehicle',
      }),
    );
    expect(navigate).toHaveBeenLastCalledWith({ to: '/vehicles/new' });
  });

  it('opens the odometer update in a dialog', async () => {
    const { user, sheet } = await openSheet();

    await user.click(within(sheet).getByRole('button', { name: 'Update odometer' }));

    expect(await screen.findByRole('dialog', { name: 'Update odometer' })).toHaveTextContent(
      'odometer for v1',
    );
  });

  it('only lets an account with nothing to log against add a vehicle', async () => {
    vehicles.data = [vehicle('v3', 'Shared Car', 'viewer')];
    const { sheet } = await openSheet();

    expect(within(sheet).getByRole('button', { name: 'Log service' })).toBeDisabled();
    expect(within(sheet).getByRole('button', { name: 'Add vehicle' })).toBeEnabled();
    expect(sheet).toHaveTextContent('Add a vehicle first');
  });
});

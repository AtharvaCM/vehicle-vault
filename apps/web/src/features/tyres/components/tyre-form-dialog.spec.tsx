import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TyrePosition, VehicleType, type Tyre } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const updateMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-tyres', () => ({
  useCreateTyre: () => createMutation,
  useUpdateTyre: () => updateMutation,
}));
vi.mock('@/lib/toast', () => ({ appToast: toasts }));

import { positionOptionsFor, TyreFormDialog } from './tyre-form-dialog';

const editedTyre: Tyre = {
  id: 't-front',
  vehicleId: 'vehicle-1',
  position: TyrePosition.Front,
  brand: 'MRF',
  model: 'Zapper',
  size: '90/90-17',
  dotWeek: 10,
  dotYear: 2025,
  fittedDate: '2025-01-01T00:00:00.000Z',
  fittedOdometer: 500,
  removedDate: null,
  removedOdometer: null,
  expectedLifeKm: null,
  notes: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('positionOptionsFor', () => {
  it('offers only front and rear for a motorcycle', () => {
    expect(positionOptionsFor(VehicleType.Motorcycle)).toEqual([
      TyrePosition.Front,
      TyrePosition.Rear,
    ]);
  });

  it('offers the four corners plus spare for a car, unaffected by two-wheeler support', () => {
    expect(positionOptionsFor(VehicleType.Car)).toEqual([
      TyrePosition.FrontLeft,
      TyrePosition.FrontRight,
      TyrePosition.RearLeft,
      TyrePosition.RearRight,
      TyrePosition.Spare,
    ]);
  });

  it('treats every other vehicle type as four-wheeled', () => {
    for (const vehicleType of [
      VehicleType.SUV,
      VehicleType.Van,
      VehicleType.Truck,
      VehicleType.Other,
    ]) {
      expect(positionOptionsFor(vehicleType)).toContain(TyrePosition.FrontLeft);
      expect(positionOptionsFor(vehicleType)).not.toContain(TyrePosition.Front);
    }
  });
});

describe('TyreFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMutation.mutateAsync.mockResolvedValue(undefined);
    updateMutation.mutateAsync.mockResolvedValue(undefined);
  });

  it('defaults a new tyre to the front position for a motorcycle', async () => {
    render(
      <TyreFormDialog
        isOpen
        onClose={vi.fn()}
        vehicleId="vehicle-1"
        vehicleOdometer={500}
        vehicleType={VehicleType.Motorcycle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add tyre/i }));

    await waitFor(() => expect(createMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutation.mutateAsync.mock.calls[0]![0]).toMatchObject({
      position: TyrePosition.Front,
    });
  });

  it('defaults a new tyre to front left for a car, as before two-wheelers were supported', async () => {
    render(
      <TyreFormDialog
        isOpen
        onClose={vi.fn()}
        vehicleId="vehicle-1"
        vehicleOdometer={6908}
        vehicleType={VehicleType.Car}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add tyre/i }));

    await waitFor(() => expect(createMutation.mutateAsync).toHaveBeenCalledTimes(1));
    expect(createMutation.mutateAsync.mock.calls[0]![0]).toMatchObject({
      position: TyrePosition.FrontLeft,
    });
  });

  it('shows the front/rear label for an edited two-wheeler tyre, disabled like any other edit', () => {
    render(
      <TyreFormDialog
        isOpen
        onClose={vi.fn()}
        tyre={editedTyre}
        vehicleId="vehicle-1"
        vehicleOdometer={500}
        vehicleType={VehicleType.Motorcycle}
      />,
    );

    const position = screen.getByLabelText('Position');
    expect(position).toBeDisabled();
    expect(position).toHaveValue('Front');
  });
});

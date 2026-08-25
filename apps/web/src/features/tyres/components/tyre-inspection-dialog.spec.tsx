import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TyrePosition, type Tyre } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const batchMutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));

vi.mock('../hooks/use-tyres', () => ({
  useCreateTyreInspections: () => batchMutation,
}));
vi.mock('@/lib/toast', () => ({ appToast: toasts }));

import { TyreInspectionDialog } from './tyre-inspection-dialog';

function makeTyre(id: string, position: TyrePosition): Tyre {
  return {
    id,
    vehicleId: 'vehicle-1',
    position,
    brand: 'Michelin',
    model: 'Primacy 4',
    size: '205/55 R16',
    dotWeek: 36,
    dotYear: 2024,
    fittedDate: '2024-10-01T00:00:00.000Z',
    fittedOdometer: 0,
    removedDate: null,
    removedOdometer: null,
    expectedLifeKm: null,
    notes: null,
    createdAt: '2024-10-01T00:00:00.000Z',
    updatedAt: '2024-10-01T00:00:00.000Z',
  };
}

const fitted = [
  makeTyre('t-fl', TyrePosition.FrontLeft),
  makeTyre('t-fr', TyrePosition.FrontRight),
];

function typeInto(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`No input matched ${selector}`);
  fireEvent.change(input, { target: { value } });
}

function renderDialog(tyres: Tyre[] = fitted) {
  const onClose = vi.fn();
  render(
    <TyreInspectionDialog
      isOpen
      onClose={onClose}
      tyres={tyres}
      vehicleId="vehicle-1"
      vehicleOdometer={41_000}
    />,
  );
  return { onClose };
}

describe('TyreInspectionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batchMutation.mutateAsync.mockResolvedValue({ saved: 1, failed: 0 });
  });

  it('offers one row per fitted tyre', () => {
    renderDialog();

    expect(screen.getByText('Front left')).toBeInTheDocument();
    expect(screen.getByText('Front right')).toBeInTheDocument();
  });

  it('excludes tyres that have already been removed', () => {
    const removed = { ...makeTyre('t-old', TyrePosition.RearLeft), removedDate: '2025-01-01T00:00:00.000Z' };
    renderDialog([...fitted, removed]);

    expect(screen.queryByText('Rear left')).not.toBeInTheDocument();
  });

  it('submits only the corners that were actually measured', async () => {
    renderDialog();

    typeInto('#tread-t-fl', '6.5');
    fireEvent.click(screen.getByRole('button', { name: /save inspection/i }));

    await waitFor(() => expect(batchMutation.mutateAsync).toHaveBeenCalled());

    const payloads = batchMutation.mutateAsync.mock.calls[0]![0];
    // A blank corner is a tyre they did not get to, not a reading of zero.
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({ tyreId: 't-fl', treadDepthMm: 6.5, odometer: 41_000 });
  });

  it('reports exactly what landed when some readings fail', async () => {
    batchMutation.mutateAsync.mockResolvedValue({ saved: 1, failed: 1 });
    const { onClose } = renderDialog();

    typeInto('#tread-t-fl', '6.5');
    typeInto('#tread-t-fr', '5.5');
    fireEvent.click(screen.getByRole('button', { name: /save inspection/i }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalled());

    // Claiming a clean save would leave the user believing a tyre is measured.
    expect(toasts.error.mock.calls[0]![0].title).toBe('Saved 1 of 2 readings');
    expect(toasts.success).not.toHaveBeenCalled();
    // The dialog stays open so the lost readings can be re-entered.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuses a walk-around where nothing was written down', async () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /save inspection/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/record a tread depth or pressure for at least one tyre/i),
      ).toBeInTheDocument(),
    );
    expect(batchMutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('explains what to do first when no tyres are tracked', () => {
    renderDialog([]);

    expect(screen.getByText(/no tyres are being tracked/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save inspection/i })).not.toBeInTheDocument();
  });
});

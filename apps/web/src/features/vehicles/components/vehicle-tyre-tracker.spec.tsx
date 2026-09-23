import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  TyrePosition,
  VehicleRole,
  VehicleType,
  type Tyre,
  type TyreInspection,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const intervalsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const conditionQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const tyresList = vi.hoisted(() => ({ current: [] as Tyre[] }));
const readingsList = vi.hoisted(() => ({ current: [] as TyreInspection[] }));
const updateTyre = vi.hoisted(() => vi.fn());
const deleteTyre = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-vehicle-intervals', () => ({
  useVehicleIntervals: () => intervalsQuery.current,
}));
vi.mock('../../tyres/hooks/use-tyres', () => ({
  useVehicleTyreCondition: () => conditionQuery.current,
  useVehicleTyres: () => ({ data: tyresList.current }),
  useVehicleTyreInspections: () => ({ data: readingsList.current }),
  useCreateTyre: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTyre: () => ({ mutateAsync: updateTyre, isPending: false }),
  useDeleteTyre: () => ({ mutateAsync: deleteTyre, isPending: false, variables: undefined }),
  useCreateTyreInspections: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

import { VehicleAccessProvider } from '../context/vehicle-access';
import type { Vehicle } from '../types/vehicle';
import { VehicleTyreTracker } from './vehicle-tyre-tracker';

/** The reported vehicle: a brand-new Virtus GT at 6,908 km with no tyre work logged. */
const newVirtus: Vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Volkswagen',
  model: 'Virtus',
  variant: 'GT Plus',
  year: 2026,
  fuelType: FuelType.Petrol,
  vehicleType: VehicleType.Car,
  odometer: 6908,
  purchaseDate: '2026-06-01T00:00:00.000Z',
  purchaseOdometer: 0,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

/** A two-wheeler: the demo Royal Enfield the issue calls out by name. */
const royalEnfield: Vehicle = {
  id: 'vehicle-2',
  registrationNumber: 'KA01AB5678',
  make: 'Royal Enfield',
  model: 'Classic 350',
  year: 2026,
  fuelType: FuelType.Petrol,
  vehicleType: VehicleType.Motorcycle,
  odometer: 4200,
  purchaseDate: '2026-08-15T00:00:00.000Z',
  purchaseOdometer: 0,
  createdAt: '2026-08-15T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

type QueryStub = Record<string, unknown>;

function settled(data: MaintenanceRecord[]): QueryStub {
  return { isPending: false, isError: false, data, refetch: vi.fn() };
}

function renderTracker(query: QueryStub, vehicle: Vehicle | null = newVirtus) {
  return render(<VehicleTyreTracker maintenanceQuery={query as never} vehicle={vehicle} />);
}

describe('VehicleTyreTracker', () => {
  beforeEach(() => {
    // The API resolves 10,000 km / 12 months for both tyre categories.
    intervalsQuery.current = {
      data: {
        [MaintenanceCategory.TyreRotation]: { km: 10_000, months: 12, source: 'default' },
        [MaintenanceCategory.WheelAlignment]: { km: 10_000, months: 12, source: 'default' },
      },
    };
    // No tyres tracked by default; the measured path is opted into per test.
    conditionQuery.current = { data: undefined };
  });

  it('does not call a new vehicle overdue when nothing has been logged', () => {
    renderTracker(settled([]));

    // The regression this guards: 6,908 km on a car with no alignment history
    // was rendered as OVERDUE, against a 5,000 km threshold that matched neither
    // the API resolver nor any real-world interval.
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('since new — none logged yet')).toHaveLength(2);
    // Both services share the 10,000 km interval the API resolver defines, so
    // both count down to the same figure.
    expect(screen.getAllByText('3,092 km to go')).toHaveLength(2);
  });

  it('reports unknown rather than guessing for a used vehicle with no history', () => {
    renderTracker(settled([]), {
      ...newVirtus,
      odometer: 62_000,
      purchaseOdometer: 60_000,
    });

    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('Not tracked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('since purchase — earlier history unknown')).toHaveLength(2);
  });

  it('shows a loading state instead of a verdict built from an empty record set', () => {
    renderTracker({ isPending: true, isError: false, refetch: vi.fn() });

    expect(screen.getByText('Loading tyre status')).toBeInTheDocument();
    expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/km to go/i)).not.toBeInTheDocument();
  });

  it('keeps reporting a failed request as an error, not as an empty history', () => {
    renderTracker({
      isPending: false,
      isError: true,
      error: new Error('Internal server error'),
      refetch: vi.fn(),
    });

    expect(screen.getByText('Unable to load tyre history')).toBeInTheDocument();
    expect(screen.queryByText('No tyre records found.')).not.toBeInTheDocument();
  });

  it('gives the wheel diagram an accessible description of both services', () => {
    renderTracker(settled([]));

    const diagram = screen.getByRole('img', { name: /wheel diagram/i });

    expect(diagram).toHaveAccessibleName(/tyre rotation: healthy/i);
    expect(diagram).toHaveAccessibleName(/wheel alignment: healthy/i);
    // The four glyphs no longer claim per-corner condition the app cannot measure.
    expect(diagram).toHaveAccessibleName(/individual tyre condition is not tracked/i);
  });

  it('lists punctures in tyre history and ignores unconfirmed drafts', () => {
    const records = [
      {
        id: 'puncture-1',
        vehicleId: newVirtus.id,
        category: MaintenanceCategory.Puncture,
        serviceDate: '2026-08-01T00:00:00.000Z',
        odometer: 6000,
        totalCost: 250,
        status: MaintenanceRecordStatus.Confirmed,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'draft-rotation',
        vehicleId: newVirtus.id,
        category: MaintenanceCategory.TyreRotation,
        serviceDate: '2026-08-10T00:00:00.000Z',
        odometer: 6500,
        totalCost: 800,
        status: MaintenanceRecordStatus.Draft,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ] as MaintenanceRecord[];

    renderTracker(settled(records));

    expect(screen.getByText('Puncture')).toBeInTheDocument();
    // An unconfirmed scan must not appear as completed work.
    expect(screen.queryByText('tyre rotation')).not.toBeInTheDocument();
  });

  it('shows measured per-corner condition once tyres are tracked', () => {
    conditionQuery.current = {
      data: {
        vehicleId: 'vehicle-1',
        overall: 'illegal',
        tyres: [
          {
            tyreId: 't-fl',
            position: TyrePosition.FrontLeft,
            level: 'illegal',
            reason: 'tread',
            summary: '1.4 mm tread — below the 1.6 mm legal minimum. Not roadworthy.',
            treadDepthMm: 1.4,
            ageYears: 2.1,
            kmOnTyre: 41_000,
            estimatedKmRemaining: 0,
            lastInspectedAt: '2026-08-20T00:00:00.000Z',
          },
          {
            tyreId: 't-rl',
            position: TyrePosition.RearLeft,
            level: 'healthy',
            reason: 'none',
            summary: '6.2 mm remaining.',
            treadDepthMm: 6.2,
            ageYears: 2.1,
            kmOnTyre: 41_000,
            estimatedKmRemaining: 28_000,
            lastInspectedAt: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
    };

    renderTracker(settled([]));

    // The four glyphs finally mean something: corners differ because the
    // measurements differ, not because of a made-up front/rear split.
    expect(screen.getByText('Front left')).toBeInTheDocument();
    expect(screen.getByText('1.4 mm')).toBeInTheDocument();
    expect(screen.getByText('6.2 mm')).toBeInTheDocument();
    expect(screen.getByText('~28,000 km left at current wear')).toBeInTheDocument();

    const diagram = screen.getByRole('img', { name: /wheel diagram/i });
    expect(diagram).toHaveAccessibleName(/front left: 1.4 mm tread/i);
    expect(diagram).toHaveAccessibleName(/rear left: 6.2 mm remaining/i);
  });

  it('says not roadworthy rather than overdue when tread is below the legal limit', () => {
    conditionQuery.current = {
      data: {
        vehicleId: 'vehicle-1',
        overall: 'illegal',
        tyres: [
          {
            tyreId: 't-fl',
            position: TyrePosition.FrontLeft,
            level: 'illegal',
            reason: 'tread',
            summary: '1.4 mm tread — below the 1.6 mm legal minimum. Not roadworthy.',
            treadDepthMm: 1.4,
            ageYears: null,
            kmOnTyre: 41_000,
            estimatedKmRemaining: 0,
            lastInspectedAt: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
    };

    renderTracker(settled([]));

    // Roadworthiness is a different class of claim from a service interval.
    expect(screen.getAllByText('Not roadworthy').length).toBeGreaterThan(0);
  });

  it('opens and closes the add-tyre dialog from the header action', () => {
    renderTracker(settled([]));

    fireEvent.click(screen.getByRole('button', { name: /add tyre/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Add a tyre' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the inspection dialog and explains that tyres come first', () => {
    renderTracker(settled([]));

    fireEvent.click(screen.getByRole('button', { name: /log inspection/i }));

    // No tyres tracked in this fixture, so the dialog has nothing to measure.
    expect(screen.getByText(/no tyres are being tracked/i)).toBeInTheDocument();
  });

  describe('each tracked tyre', () => {
    const frontLeft: Tyre = {
      id: 't-fl',
      vehicleId: 'vehicle-1',
      position: TyrePosition.FrontLeft,
      brand: 'Michelin',
      model: 'Primacy 4',
      size: '205/55 R16',
      dotWeek: 36,
      dotYear: 2024,
      fittedDate: '2025-01-10T00:00:00.000Z',
      fittedOdometer: 2000,
      removedDate: null,
      removedOdometer: null,
      expectedLifeKm: 45000,
      notes: null,
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    };

    const reading = (overrides: Partial<TyreInspection>): TyreInspection => ({
      id: 'r-1',
      tyreId: 't-fl',
      vehicleId: 'vehicle-1',
      inspectedAt: '2026-08-20T00:00:00.000Z',
      odometer: 6800,
      treadDepthMm: 5.2,
      pressurePsi: 32,
      notes: null,
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: '2026-08-20T00:00:00.000Z',
      ...overrides,
    });

    beforeEach(() => {
      updateTyre.mockReset().mockResolvedValue(undefined);
      deleteTyre.mockReset().mockResolvedValue(undefined);
      tyresList.current = [frontLeft];
      // Newest first, as the API returns them.
      readingsList.current = [
        reading({ id: 'r-2', inspectedAt: '2026-08-20T00:00:00.000Z', treadDepthMm: 5.25 }),
        reading({
          id: 'r-1',
          inspectedAt: '2026-02-01T00:00:00.000Z',
          odometer: 4100,
          treadDepthMm: 7,
          pressurePsi: null,
          notes: 'After the rotation',
        }),
      ];
      conditionQuery.current = {
        data: {
          vehicleId: 'vehicle-1',
          overall: 'healthy',
          tyres: [
            {
              tyreId: 't-fl',
              position: TyrePosition.FrontLeft,
              level: 'healthy',
              reason: 'none',
              summary: '5.3 mm tread remaining.',
              treadDepthMm: 5.25,
              ageYears: 2,
              kmOnTyre: 4800,
              estimatedKmRemaining: null,
              lastInspectedAt: '2026-08-20T00:00:00.000Z',
            },
          ],
        },
      };
    });

    it('lists its readings newest first, as they were recorded', () => {
      renderTracker(settled([]));

      expect(screen.getByText('Michelin Primacy 4 · 205/55 R16 · DOT 3624')).toBeInTheDocument();
      const list = screen.getByRole('list', { name: 'Front left tyre readings, newest first' });
      expect(list).not.toBeVisible();

      fireEvent.click(screen.getByText('Readings (2)'));

      expect(list).toBeVisible();
      const rows = within(list).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('5.25 mm tread · 32 psi');
      expect(rows[0]).toHaveTextContent('6,800 km');
      // A reading that measured only tread says only that.
      expect(rows[1]).toHaveTextContent('7 mm tread');
      expect(rows[1]).not.toHaveTextContent('psi');
      expect(rows[1]).toHaveTextContent('After the rotation');
    });

    it('edits the tyre in place, leaving position and readings where they are', async () => {
      renderTracker(settled([]));

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByRole('heading', { name: 'Edit tyre' })).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Position')).toBeDisabled();
      expect(within(dialog).getByLabelText('Position')).toHaveValue('Front left');
      const dot = within(dialog).getByLabelText('DOT code');
      expect(dot).toHaveValue('3624');

      fireEvent.change(dot, { target: { value: '0118' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(updateTyre).toHaveBeenCalledTimes(1));
      const { tyreId, input } = updateTyre.mock.calls[0]![0] as {
        tyreId: string;
        input: Record<string, unknown>;
      };
      expect(tyreId).toBe('t-fl');
      expect(input).toMatchObject({
        brand: 'Michelin',
        dotWeek: 1,
        dotYear: 2018,
        fittedOdometer: 2000,
        fittedDate: '2025-01-10T00:00:00.000Z',
      });
      // Moving a tyre is fitting it elsewhere, which only the add path does.
      expect(input).not.toHaveProperty('position');
      expect(input).not.toHaveProperty('removedDate');
    });

    it('asks before deleting, and says the readings go with it', async () => {
      renderTracker(settled([]));

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const confirm = screen.getByRole('alertdialog');
      expect(
        within(confirm).getByRole('heading', { name: 'Delete the front left tyre?' }),
      ).toBeInTheDocument();
      expect(confirm).toHaveTextContent('Its 2 readings will be deleted with it.');
      expect(deleteTyre).not.toHaveBeenCalled();

      fireEvent.click(within(confirm).getByRole('button', { name: 'Delete tyre' }));

      await waitFor(() => expect(deleteTyre).toHaveBeenCalledWith('t-fl'));
    });

    it('shows a viewer the readings but neither control', () => {
      render(
        <VehicleAccessProvider role={VehicleRole.Viewer}>
          <VehicleTyreTracker maintenanceQuery={settled([]) as never} vehicle={newVirtus} />
        </VehicleAccessProvider>,
      );

      expect(screen.getByText('Readings (2)')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });

  it('offers adding a tyre from the empty state as well as the header', () => {
    renderTracker(settled([]));

    fireEvent.click(screen.getByRole('button', { name: /add a tyre/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('VehicleTyreTracker two-wheeler layout', () => {
  beforeEach(() => {
    intervalsQuery.current = {
      data: {
        [MaintenanceCategory.TyreRotation]: { km: 10_000, months: 12, source: 'default' },
        [MaintenanceCategory.WheelAlignment]: { km: 10_000, months: 12, source: 'default' },
      },
    };
    conditionQuery.current = { data: undefined };
  });

  it('hides tyre rotation and relabels alignment for a motorcycle', () => {
    render(<VehicleTyreTracker maintenanceQuery={settled([]) as never} vehicle={royalEnfield} />);

    // A two-wheeler has no left/right pair to rotate, so the card must not
    // claim a rotation status it cannot support.
    expect(screen.queryByText('Tyre Rotation')).not.toBeInTheDocument();
    expect(screen.getByText('Wheel Alignment / Balancing')).toBeInTheDocument();
  });

  it('keeps both cards, unrelabelled, for a car', () => {
    renderTracker(settled([]));

    expect(screen.getByText('Tyre Rotation')).toBeInTheDocument();
    expect(screen.getByText('Wheel Alignment')).toBeInTheDocument();
    expect(screen.queryByText('Wheel Alignment / Balancing')).not.toBeInTheDocument();
  });

  it('gives the wheel diagram a front/rear description, not a four-corner one', () => {
    render(<VehicleTyreTracker maintenanceQuery={settled([]) as never} vehicle={royalEnfield} />);

    const diagram = screen.getByRole('img', { name: /wheel diagram/i });
    expect(diagram).toHaveAccessibleName(/wheel alignment \/ balancing: healthy/i);
    // No rotation claim of any kind for a vehicle that has no rotation service.
    expect(diagram).not.toHaveAccessibleName(/tyre rotation/i);
  });

  it('shows Front and Rear corners with their measured condition, not FL/FR/RL/RR', () => {
    conditionQuery.current = {
      data: {
        vehicleId: 'vehicle-2',
        overall: 'healthy',
        tyres: [
          {
            tyreId: 't-front',
            position: TyrePosition.Front,
            level: 'healthy',
            reason: 'none',
            summary: '5.5 mm remaining.',
            treadDepthMm: 5.5,
            ageYears: 1,
            kmOnTyre: 4200,
            estimatedKmRemaining: 12_000,
            lastInspectedAt: '2026-08-20T00:00:00.000Z',
          },
          {
            tyreId: 't-rear',
            position: TyrePosition.Rear,
            level: 'warn',
            reason: 'tread',
            summary: '3.2 mm tread — plan a replacement in the next few thousand kilometres.',
            treadDepthMm: 3.2,
            ageYears: 1,
            kmOnTyre: 4200,
            estimatedKmRemaining: 2_000,
            lastInspectedAt: '2026-08-20T00:00:00.000Z',
          },
        ],
      },
    };

    render(<VehicleTyreTracker maintenanceQuery={settled([]) as never} vehicle={royalEnfield} />);

    expect(screen.getByText('Front')).toBeInTheDocument();
    expect(screen.getByText('Rear')).toBeInTheDocument();
    expect(screen.queryByText('Front left')).not.toBeInTheDocument();
    expect(screen.queryByText('Rear right')).not.toBeInTheDocument();

    const diagram = screen.getByRole('img', { name: /wheel diagram/i });
    expect(diagram).toHaveAccessibleName(/front: 5.5 mm remaining/i);
    expect(diagram).toHaveAccessibleName(/rear: 3.2 mm tread/i);
  });
});

import { render, screen } from '@testing-library/react';
import {
  FuelType,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  TyrePosition,
  VehicleType,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const intervalsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const conditionQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../hooks/use-vehicle-intervals', () => ({
  useVehicleIntervals: () => intervalsQuery.current,
}));
vi.mock('../../tyres/hooks/use-tyres', () => ({
  useVehicleTyreCondition: () => conditionQuery.current,
}));

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

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

type QueryStub = Record<string, unknown>;

function settled(data: MaintenanceRecord[]): QueryStub {
  return { isPending: false, isError: false, data, refetch: vi.fn() };
}

function renderTracker(query: QueryStub, vehicle: Vehicle | null = newVirtus) {
  return render(
    <VehicleTyreTracker
      maintenanceQuery={query as never}
      vehicle={vehicle}
    />,
  );
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
    expect(
      screen.getAllByText('since purchase — earlier history unknown'),
    ).toHaveLength(2);
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

    expect(screen.getByText('puncture')).toBeInTheDocument();
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
});

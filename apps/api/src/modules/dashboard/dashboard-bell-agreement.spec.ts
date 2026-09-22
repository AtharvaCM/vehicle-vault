import { ServiceBaselineStatus, VehicleRole as PrismaVehicleRole } from '@prisma/client';
import {
  FuelType,
  MaintenanceRecordStatus,
  TyrePosition,
  VehicleRole,
  VehicleType,
  type TyreCondition,
} from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceAlertService } from '../notifications/maintenance-alert.service';
import type { VehicleTyreAlertState } from '../tyres/tyres.service';
import { DashboardService } from './dashboard.service';

/**
 * The bell and the attention queue, run side by side on the same vehicle.
 *
 * The queue's tyre, service-history and accessory rows exist so nobody has to
 * open the bell to learn what it knows. These tests hold the two to that: for
 * each person the vehicle is shared with, every verdict the engine raises has
 * its row in that person's queue, and the queue has no such row the engine
 * would not raise.
 */

const NOW = new Date('2026-09-22T06:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const OWNER = 'owner-1';
const VIEWER = 'viewer-1';

type Scenario = {
  createdAt: Date;
  year: number;
  odometer: number;
  confirmedRecords: { category: string; odometer: number }[];
  baselines: { category: string; status: ServiceBaselineStatus; lastDoneOdometer: number | null }[];
  tyres: VehicleTyreAlertState;
  accessories: { id: string; name: string; brand: string | null; expiresInDays: number }[];
};

function tyre(overrides: Partial<TyreCondition>): TyreCondition {
  return {
    tyreId: 'tyre-1',
    position: TyrePosition.FrontLeft,
    level: 'healthy',
    reason: 'none',
    summary: '6.0 mm tread remaining.',
    treadDepthMm: 6,
    ageYears: 2,
    kmOnTyre: 8000,
    estimatedKmRemaining: null,
    lastInspectedAt: null,
    ...overrides,
  };
}

const INTERVALS = {
  engine_oil: { km: 7500, months: 6, source: 'default' },
  brake_pads: { km: 30000, months: 24, source: 'default' },
  coolant: { km: 40000, months: 24, source: 'default' },
};

/** A vehicle with something to say on every one of the queue's new kinds. */
const EVERYTHING: Scenario = {
  createdAt: new Date('2025-06-01T00:00:00.000Z'),
  year: 2019,
  odometer: 42000,
  confirmedRecords: [{ category: 'engine_oil', odometer: 40000 }],
  baselines: [
    { category: 'brake_pads', status: ServiceBaselineStatus.unknown, lastDoneOdometer: null },
    { category: 'coolant', status: ServiceBaselineStatus.unknown, lastDoneOdometer: null },
  ],
  tyres: {
    vehicleOdometer: 42000,
    conditions: [
      tyre({ tyreId: 'fl', level: 'illegal', reason: 'tread', treadDepthMm: 1.4 }),
      tyre({ tyreId: 'fr', position: TyrePosition.FrontRight, level: 'warn', reason: 'tread' }),
      tyre({ tyreId: 'rl', position: TyrePosition.RearLeft, level: 'replace', reason: 'age' }),
      tyre({ tyreId: 'rr', position: TyrePosition.RearRight }),
    ],
    lastObservation: { at: new Date(NOW.getTime() - 200 * DAY), odometer: 30000 },
  },
  accessories: [{ id: 'dashcam', name: 'Dashcam', brand: '70mai', expiresInDays: 5 }],
};

/** Told everything, measured lately, nothing expiring. */
const NOTHING_WRONG: Scenario = {
  ...EVERYTHING,
  confirmedRecords: [
    { category: 'engine_oil', odometer: 40000 },
    { category: 'brake_pads', odometer: 38000 },
    { category: 'coolant', odometer: 38000 },
  ],
  baselines: [],
  tyres: {
    vehicleOdometer: 42000,
    conditions: [tyre({})],
    lastObservation: { at: new Date(NOW.getTime() - 10 * DAY), odometer: 41500 },
  },
  accessories: [],
};

/** Added two days ago with nothing on file: the questions wait, a worn tyre does not. */
const JUST_ADDED: Scenario = {
  ...EVERYTHING,
  createdAt: new Date(NOW.getTime() - 2 * DAY),
  confirmedRecords: [],
  baselines: [],
  tyres: {
    vehicleOdometer: 42000,
    conditions: [tyre({ tyreId: 'fl', level: 'replace', reason: 'tread', treadDepthMm: 2.5 })],
    lastObservation: { at: new Date(NOW.getTime() - 1 * DAY), odometer: 41990 },
  },
  accessories: [],
};

/** A tyre-less vehicle nobody has told anything, long settled: both questions, nothing else. */
const UNTOLD: Scenario = {
  ...EVERYTHING,
  confirmedRecords: [],
  baselines: [],
  tyres: { vehicleOdometer: 42000, conditions: [], lastObservation: null },
  accessories: [],
};

const prisma = {
  vehicle: { findUnique: vi.fn() },
  reminder: { findMany: vi.fn() },
  warranty: { findMany: vi.fn() },
  auditEvent: { findFirst: vi.fn() },
  fuelLog: { count: vi.fn(), groupBy: vi.fn() },
  documentDismissal: { findMany: vi.fn() },
  serviceBaseline: { findMany: vi.fn() },
};
const notify = { raise: vi.fn() };
const tyres = { getAlertState: vi.fn() };
const accessories = { findExpiringWarranties: vi.fn() };
const intervals = { resolveForVehicle: vi.fn() };

function arrange(scenario: Scenario) {
  const vehicleRow = {
    id: 'v1',
    userId: OWNER,
    year: scenario.year,
    odometer: scenario.odometer,
    createdAt: scenario.createdAt,
  };
  const accessoryRows = scenario.accessories.map((accessory) => ({
    id: accessory.id,
    vehicleId: 'v1',
    name: accessory.name,
    brand: accessory.brand,
    warrantyExpiresAt: new Date(NOW.getTime() + accessory.expiresInDays * DAY),
    expiresInDays: accessory.expiresInDays,
  }));

  prisma.vehicle.findUnique.mockResolvedValue({
    ...vehicleRow,
    maintenanceRecords: scenario.confirmedRecords,
    serviceBaselines: scenario.baselines,
    members: [
      { userId: OWNER, role: PrismaVehicleRole.owner },
      { userId: VIEWER, role: PrismaVehicleRole.viewer },
    ],
  });
  prisma.reminder.findMany.mockResolvedValue([]);
  prisma.warranty.findMany.mockResolvedValue([]);
  prisma.auditEvent.findFirst.mockResolvedValue({ id: 'recent' });
  prisma.fuelLog.count.mockResolvedValue(0);
  prisma.fuelLog.groupBy.mockResolvedValue([]);
  prisma.documentDismissal.findMany.mockResolvedValue([]);
  prisma.serviceBaseline.findMany.mockResolvedValue(
    scenario.baselines.map((row) => ({ ...row, vehicleId: 'v1' })),
  );
  tyres.getAlertState.mockResolvedValue(scenario.tyres);
  intervals.resolveForVehicle.mockResolvedValue(INTERVALS);
  // Answered the way the query would be: fitted accessories whose warranty
  // runs out between today and the window's last day.
  accessories.findExpiringWarranties.mockImplementation((_userId: string, withinDays: number) =>
    Promise.resolve(accessoryRows.filter((row) => row.expiresInDays <= withinDays)),
  );

  const engine = new MaintenanceAlertService(
    prisma as never,
    {
      getOdometerInsights: vi
        .fn()
        .mockResolvedValue({ currentOdometerPredicted: scenario.odometer }),
    } as never,
    notify as never,
    { findExpiring: vi.fn().mockResolvedValue([]) } as never,
    intervals as never,
    accessories as never,
    tyres as never,
  );

  const dashboardFor = (role: VehicleRole) =>
    new DashboardService(
      {
        getAllVehicles: vi.fn().mockResolvedValue([
          {
            ...vehicleRow,
            registrationNumber: 'MH12AB1234',
            make: 'Maruti',
            model: 'Swift',
            fuelType: FuelType.Petrol,
            vehicleType: VehicleType.Car,
            nickname: 'Swift',
            createdAt: scenario.createdAt.toISOString(),
            updatedAt: NOW.toISOString(),
            currentUserRole: role,
          },
        ]),
      } as never,
      {
        getAllRecords: vi.fn().mockResolvedValue(
          scenario.confirmedRecords.map((record, index) => ({
            ...record,
            id: `record-${index}`,
            vehicleId: 'v1',
            serviceDate: '2026-01-01T00:00:00.000Z',
            totalCost: 1000,
            status: MaintenanceRecordStatus.Confirmed,
          })),
        ),
      } as never,
      { getAllReminders: vi.fn().mockResolvedValue([]) } as never,
      { listAllAttachments: vi.fn().mockResolvedValue([]) } as never,
      { getUpcomingSuggestions: vi.fn().mockResolvedValue([]) } as never,
      { listForUser: vi.fn().mockResolvedValue([]) } as never,
      { listForUser: vi.fn().mockResolvedValue([]) } as never,
      prisma as never,
      {} as never,
      tyres as never,
      accessories as never,
      intervals as never,
    );

  return { engine, dashboardFor };
}

/** The queue row each raised alert should have, by the row ids the dashboard uses. */
function rowIdFor(kind: string, payload: Record<string, unknown>): string | null {
  switch (kind) {
    case 'tyre-worn':
    case 'tyre-aged':
      return `tyre:${String(payload.tyreId)}`;
    case 'tyre-uninspected':
      return `tyre-check:${String(payload.vehicleId)}`;
    case 'service-baseline-unknown':
      return `service-history:${String(payload.vehicleId)}`;
    case 'accessory-warranty-expiring':
      return `accessory:${String((payload.accessory as { id: string }).id)}`;
    default:
      return null;
  }
}

function bellFor(userId: string): string[] {
  const ids = notify.raise.mock.calls
    .filter(([recipient]) => recipient === userId)
    .map(([, , kind, payload]) => rowIdFor(kind as string, payload as Record<string, unknown>))
    .filter((id): id is string => id !== null);

  return [...new Set(ids)].sort();
}

async function queueFor(
  dashboardFor: (role: VehicleRole) => DashboardService,
  userId: string,
  role: VehicleRole,
): Promise<string[]> {
  const summary = await dashboardFor(role).getSummary(userId);

  return summary.attention
    .filter((item) => ['tyre', 'service_baseline', 'accessory'].includes(item.kind))
    .map((item) => item.id)
    .sort();
}

describe('the attention queue and the bell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['a vehicle with something on every count', EVERYTHING],
    ['a vehicle with nothing wrong', NOTHING_WRONG],
    ['a vehicle added two days ago', JUST_ADDED],
    ['a settled vehicle nobody has told anything', UNTOLD],
  ])('agree about %s, for the owner and for a viewer', async (_label, scenario) => {
    const { engine, dashboardFor } = arrange(scenario);

    await engine.runAlertChecks('v1');

    expect(await queueFor(dashboardFor, OWNER, VehicleRole.Owner)).toEqual(bellFor(OWNER));
    expect(await queueFor(dashboardFor, VIEWER, VehicleRole.Viewer)).toEqual(bellFor(VIEWER));
  });

  it('are not agreeing about nothing', async () => {
    // Guards the test above: were both sides silent, it would pass on its own.
    const { engine, dashboardFor } = arrange(EVERYTHING);

    await engine.runAlertChecks('v1');

    expect(bellFor(OWNER)).toEqual([
      'accessory:dashcam',
      'service-history:v1',
      'tyre-check:v1',
      'tyre:fl',
      'tyre:fr',
      'tyre:rl',
    ]);
    expect(bellFor(VIEWER)).toEqual(['accessory:dashcam', 'tyre:fl', 'tyre:fr', 'tyre:rl']);
    expect(await queueFor(dashboardFor, OWNER, VehicleRole.Owner)).toHaveLength(6);
  });
});

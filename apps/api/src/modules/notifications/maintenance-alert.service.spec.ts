import { ServiceBaselineStatus } from '@prisma/client';
import { MaintenanceRecordStatus, TyrePosition, type TyreCondition } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceAlertService } from './maintenance-alert.service';
import type { VehicleTyreAlertState } from '../tyres/tyres.service';

const NOW = new Date('2026-09-08T06:00:00.000Z');

const VEHICLE = {
  id: 'v1',
  userId: 'u1',
  year: 2024,
  odometer: 40_000,
  // `status` is optional for the same reason the column has a default: a record
  // without one is confirmed. Only the draft tests say it out loud.
  maintenanceRecords: [] as {
    category: string;
    odometer: number;
    status?: MaintenanceRecordStatus;
  }[],
  serviceBaselines: [] as {
    category: string;
    status: ServiceBaselineStatus;
    lastDoneOdometer: number | null;
  }[],
};

function condition(overrides: Partial<TyreCondition>): TyreCondition {
  return {
    tyreId: 'tyre-1',
    position: TyrePosition.FrontLeft,
    level: 'healthy',
    reason: 'none',
    summary: '5.0 mm remaining.',
    treadDepthMm: 5,
    ageYears: 2,
    kmOnTyre: 8_000,
    estimatedKmRemaining: null,
    lastInspectedAt: null,
    ...overrides,
  };
}

const prisma = {
  vehicle: { findUnique: vi.fn() },
  reminder: { findMany: vi.fn() },
};
const insights = { getOdometerInsights: vi.fn() };
const notify = { raise: vi.fn() };
const documents = { findExpiring: vi.fn() };
const intervals = { resolveForVehicle: vi.fn() };
const accessories = { findExpiringWarranties: vi.fn() };
const tyres = { getAlertState: vi.fn() };

const alertState = (overrides: Partial<VehicleTyreAlertState>): VehicleTyreAlertState => ({
  vehicleOdometer: 40_000,
  conditions: [],
  lastObservation: { at: new Date('2026-09-01T00:00:00.000Z'), odometer: 39_800 },
  ...overrides,
});

/** Raised alerts of one kind, so an unrelated engine change cannot quietly pass a test. */
const alertsOfKind = (kind: string) =>
  notify.raise.mock.calls
    .filter(([, , raised]) => raised === kind)
    .map(([, , , payload]) => payload);

const kindsRaised = () => notify.raise.mock.calls.map(([, , kind]) => kind);

function buildService(): MaintenanceAlertService {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  prisma.vehicle.findUnique.mockResolvedValue(VEHICLE);
  prisma.reminder.findMany.mockResolvedValue([]);
  insights.getOdometerInsights.mockResolvedValue({ currentOdometerPredicted: 40_000 });
  intervals.resolveForVehicle.mockResolvedValue({});
  documents.findExpiring.mockResolvedValue([]);
  accessories.findExpiringWarranties.mockResolvedValue([]);
  tyres.getAlertState.mockResolvedValue(alertState({}));

  return new MaintenanceAlertService(
    prisma as never,
    insights as never,
    notify as never,
    documents as never,
    intervals as never,
    accessories as never,
    tyres as never,
  );
}

describe('MaintenanceAlertService tyre checks', () => {
  let service: MaintenanceAlertService;

  const tyreAlerts = () =>
    notify.raise.mock.calls
      .filter(([, , kind]) => String(kind).startsWith('tyre-'))
      .map(([, , kind, payload]) => ({ kind, payload }));

  beforeEach(() => {
    service = buildService();
    // Emptied so the tyre assertions below are not entangled with service-interval maths.
    intervals.resolveForVehicle.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('raises nothing while the tyres are healthy and recently measured', async () => {
    tyres.getAlertState.mockResolvedValue(alertState({ conditions: [condition({})] }));

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('raises a worn tyre from the resolver’s verdict', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [
          condition({
            level: 'illegal',
            reason: 'tread',
            summary: '1.4 mm tread — below the 1.6 mm legal minimum. Not roadworthy.',
            treadDepthMm: 1.4,
          }),
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-worn',
        payload: expect.objectContaining({
          tyreId: 'tyre-1',
          level: 'illegal',
          treadDepthMm: 1.4,
        }),
      },
    ]);
  });

  it('raises an aged tyre that no odometer would ever flag', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [
          condition({
            level: 'replace',
            reason: 'age',
            ageYears: 6.4,
            summary: '6.4 years old — rubber degrades with age regardless of tread left.',
          }),
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      { kind: 'tyre-aged', payload: expect.objectContaining({ level: 'replace', ageYears: 6.4 }) },
    ]);
  });

  it('says nothing about a tyre nobody has measured', async () => {
    // `unknown` is the absence of a reading. Calling it worn would invent one;
    // the inspection prompt is the honest answer, and it fires below.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({ level: 'unknown', reason: 'none' })],
        lastObservation: { at: new Date('2026-09-01T00:00:00.000Z'), odometer: 39_800 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('asks a well-travelled vehicle with no tyre records to enter them', async () => {
    // The case that let a 40 000 km bike wear its tyres to the cords in silence.
    tyres.getAlertState.mockResolvedValue(alertState({ conditions: [], lastObservation: null }));

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({ reason: 'untracked', odometer: 40_000 }),
      },
    ]);
  });

  it('leaves a young, barely used vehicle alone', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE, odometer: 1_200 });
    tyres.getAlertState.mockResolvedValue(
      alertState({ vehicleOdometer: 1_200, conditions: [], lastObservation: null }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });

  it('still asks an old low-mileage vehicle, because rubber ages while parked', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE, year: 2015, odometer: 1_200 });
    tyres.getAlertState.mockResolvedValue(
      alertState({ vehicleOdometer: 1_200, conditions: [], lastObservation: null }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      { kind: 'tyre-uninspected', payload: expect.objectContaining({ reason: 'untracked' }) },
    ]);
  });

  it('asks for a fresh reading once the last one is too many kilometres old', async () => {
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({})],
        lastObservation: { at: new Date('2026-08-20T00:00:00.000Z'), odometer: 33_500 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({
          reason: 'stale',
          kmSinceLastCheck: 6_500,
          daysSinceLastCheck: 19,
        }),
      },
    ]);
  });

  it('asks for a fresh reading on a vehicle that has barely moved but sat for months', async () => {
    // Distance alone would never catch this one, and a tyre degrades anyway.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({})],
        lastObservation: { at: new Date('2025-11-01T00:00:00.000Z'), odometer: 39_950 },
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([
      {
        kind: 'tyre-uninspected',
        payload: expect.objectContaining({ reason: 'stale', kmSinceLastCheck: 50 }),
      },
    ]);
  });

  it('leaves the tyre walk-around reminder to the measurements', async () => {
    // Both would otherwise nag about one thing and disagree about it: the
    // reminder goes overdue when nobody ticked a box, `tyre-uninspected` when
    // nobody actually looked. Only the second is true about the tyres.
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        vehicleId: 'v1',
        title: 'Tyre tread & pressure check',
        dueOdometer: 35_000,
        notes: 'Measure tread depth at each corner.\n[catalog:tyre_inspection]',
      },
    ]);

    await service.runAlertChecks('v1');

    expect(kindsRaised()).not.toContain('reminder-due');
    expect(kindsRaised()).not.toContain('reminder-overdue');
  });

  it('still alerts on every other overdue reminder', async () => {
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'rem-2',
        vehicleId: 'v1',
        title: 'Rotate tyres',
        dueOdometer: 35_000,
        notes: '[catalog:tyre_rotation]',
      },
    ]);

    await service.runAlertChecks('v1');

    expect(kindsRaised()).toContain('reminder-overdue');
  });

  it('has nothing to ask of a vehicle carrying only a spare', async () => {
    // No road tyre means no distance to measure staleness against, and the
    // "untracked" wording would be a lie — tyres are recorded.
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({ position: TyrePosition.Spare })],
        lastObservation: null,
      }),
    );

    await service.runAlertChecks('v1');

    expect(tyreAlerts()).toEqual([]);
  });
});

describe('MaintenanceAlertService service baselines', () => {
  let service: MaintenanceAlertService;

  /** Brake pads: a long interval, so the arithmetic below is unambiguous. */
  const BRAKE_PADS = { brake_pads: { km: 30_000, months: 24, source: 'default' } };

  const vehicle = (overrides: Partial<typeof VEHICLE>) => ({ ...VEHICLE, ...overrides });

  beforeEach(() => {
    service = buildService();
    intervals.resolveForVehicle.mockResolvedValue(BRAKE_PADS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('measures the interval from a baseline reading', async () => {
    // 5 000 km when the pads were last done, 40 000 now, 30 000 km interval:
    // 5 000 km overdue. Before the baseline table there was no way to say this.
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({
        serviceBaselines: [
          {
            category: 'brake_pads',
            status: ServiceBaselineStatus.known,
            lastDoneOdometer: 5_000,
          },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('maintenance-overdue')).toEqual([
      expect.objectContaining({ category: 'brake_pads', remainingDistanceKm: -5_000 }),
    ]);
  });

  it('lets a logged service supersede the baseline', async () => {
    // The baseline was a recollection; the record is a measurement.
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({
        maintenanceRecords: [{ category: 'brake_pads', odometer: 38_000 }],
        serviceBaselines: [
          {
            category: 'brake_pads',
            status: ServiceBaselineStatus.known,
            lastDoneOdometer: 5_000,
          },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('maintenance-overdue')).toEqual([]);
    expect(alertsOfKind('maintenance-due')).toEqual([]);
  });

  it('asks rather than guesses when the owner has said they do not know', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({
        serviceBaselines: [
          {
            category: 'brake_pads',
            status: ServiceBaselineStatus.unknown,
            lastDoneOdometer: null,
          },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([
      expect.objectContaining({ scope: 'category', category: 'brake_pads', intervalKm: 30_000 }),
    ]);
    // No due/overdue alert alongside it: there is no figure to have computed one from.
    expect(alertsOfKind('maintenance-due')).toEqual([]);
    expect(alertsOfKind('maintenance-overdue')).toEqual([]);
  });

  it('stays quiet on a baseline that knows only a date', async () => {
    // Distance arithmetic cannot use it, and turning that date into an odometer
    // via the mileage forecast would let a projection declare a service overdue.
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({
        serviceBaselines: [
          {
            category: 'brake_pads',
            status: ServiceBaselineStatus.known,
            lastDoneOdometer: null,
          },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(kindsRaised()).not.toContain('maintenance-overdue');
    expect(kindsRaised()).not.toContain('service-baseline-unknown');
  });

  it('keeps the old fallback for a vehicle nobody has been asked about', async () => {
    // Every vehicle predating this table is in this state. The fallback still
    // measures from the odometer on the vehicle — which quietly assumes
    // everything had just been done — but it must not turn into a per-category
    // alert, or the release greets each existing garage with a wall of them.
    prisma.vehicle.findUnique.mockResolvedValue(vehicle({}));

    await service.runAlertChecks('v1');

    expect(alertsOfKind('maintenance-overdue')).toEqual([]);
    expect(alertsOfKind('service-baseline-unknown')).toEqual([
      expect.objectContaining({ scope: 'vehicle' }),
    ]);
  });

  it('prompts once for the whole vehicle rather than once per category', async () => {
    intervals.resolveForVehicle.mockResolvedValue({
      ...BRAKE_PADS,
      engine_oil: { km: 7_500, months: 6, source: 'default' },
      coolant: { km: 40_000, months: 24, source: 'default' },
    });
    prisma.vehicle.findUnique.mockResolvedValue(vehicle({}));

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toHaveLength(1);
  });

  it('stops prompting once the vehicle has any history at all', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({ maintenanceRecords: [{ category: 'engine_oil', odometer: 30_000 }] }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([]);
  });

  it('stops prompting once any baseline has been answered', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(
      vehicle({
        serviceBaselines: [
          {
            category: 'engine_oil',
            status: ServiceBaselineStatus.unknown,
            lastDoneOdometer: null,
          },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([]);
  });

  it('leaves a young, barely used vehicle alone', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicle({ odometer: 800, year: 2026 }));

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([]);
  });

  it('still asks an old low-mileage vehicle, because wear items age on the calendar', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(vehicle({ odometer: 800, year: 2015 }));

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([
      expect.objectContaining({ scope: 'vehicle', odometer: 800 }),
    ]);
  });
});

describe('MaintenanceAlertService draft maintenance records', () => {
  let service: MaintenanceAlertService;

  const BRAKE_PADS = { brake_pads: { km: 30_000, months: 24, source: 'default' } };

  const vehicle = (overrides: Partial<typeof VEHICLE>) => ({ ...VEHICLE, ...overrides });

  /**
   * Resolves the vehicle the way Prisma would: by applying the `where` the
   * engine puts on its `maintenanceRecords` include. A plain `mockResolvedValue`
   * hands back rows the database was never asked for, so these assertions would
   * still pass with the status filter deleted.
   */
  const findUniqueHonouringInclude = (row: typeof VEHICLE) => {
    prisma.vehicle.findUnique.mockImplementation((args: unknown) => {
      const wanted = (
        args as { include?: { maintenanceRecords?: { where?: { status?: string } } } }
      ).include?.maintenanceRecords?.where?.status;

      return Promise.resolve({
        ...row,
        maintenanceRecords: wanted
          ? row.maintenanceRecords.filter(
              (record) => (record.status ?? MaintenanceRecordStatus.Confirmed) === wanted,
            )
          : row.maintenanceRecords,
      });
    });
  };

  beforeEach(() => {
    service = buildService();
    intervals.resolveForVehicle.mockResolvedValue(BRAKE_PADS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not let a draft silence an overdue service', async () => {
    // The owner said at onboarding that the pads were last done at 5 000 km and
    // the bike is at 40 000, so this is 5 000 km overdue. A draft sitting at
    // 38 000 — an extraction nobody has confirmed — used to make that reminder
    // disappear, because the engine read it as "this service was done".
    findUniqueHonouringInclude(
      vehicle({
        maintenanceRecords: [
          { category: 'brake_pads', odometer: 38_000, status: MaintenanceRecordStatus.Draft },
        ],
        serviceBaselines: [
          { category: 'brake_pads', status: ServiceBaselineStatus.known, lastDoneOdometer: 5_000 },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('maintenance-overdue')).toEqual([
      expect.objectContaining({ category: 'brake_pads', remainingDistanceKm: -5_000 }),
    ]);
  });

  it('still lets the same record silence it once it is confirmed', async () => {
    // The other half of the pair: confirming the draft is what turns it into a
    // measurement, and then it supersedes the baseline as it always did.
    findUniqueHonouringInclude(
      vehicle({
        maintenanceRecords: [
          { category: 'brake_pads', odometer: 38_000, status: MaintenanceRecordStatus.Confirmed },
        ],
        serviceBaselines: [
          { category: 'brake_pads', status: ServiceBaselineStatus.known, lastDoneOdometer: 5_000 },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('maintenance-overdue')).toEqual([]);
    expect(alertsOfKind('maintenance-due')).toEqual([]);
  });

  it('does not count a draft as the history that stops the service prompt', async () => {
    // Nobody has agreed this draft describes a real service, so the vehicle is
    // still one the app has been told nothing about.
    findUniqueHonouringInclude(
      vehicle({
        maintenanceRecords: [
          { category: 'engine_oil', odometer: 30_000, status: MaintenanceRecordStatus.Draft },
        ],
      }),
    );

    await service.runAlertChecks('v1');

    expect(alertsOfKind('service-baseline-unknown')).toEqual([
      expect.objectContaining({ scope: 'vehicle' }),
    ]);
  });
});

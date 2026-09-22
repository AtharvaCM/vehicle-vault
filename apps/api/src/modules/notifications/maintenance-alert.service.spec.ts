import { ServiceBaselineStatus, VehicleRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MaintenanceRecordStatus, TyrePosition, type TyreCondition } from '@vehicle-vault/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MaintenanceAlertService } from './maintenance-alert.service';
import { NotifyService } from './notify.service';
import { MaintenanceOverdueTemplate } from './templates/maintenance-overdue.template';
import { ReminderDueTemplate } from './templates/reminder-due.template';
import { ServiceBaselineUnknownTemplate } from './templates/service-baseline-unknown.template';
import { TyreWornTemplate } from './templates/tyre-worn.template';
import type { VehicleTyreAlertState } from '../tyres/tyres.service';

const NOW = new Date('2026-09-08T06:00:00.000Z');

const VEHICLE = {
  id: 'v1',
  userId: 'u1',
  year: 2024,
  odometer: 40_000,
  // Long past the new-vehicle grace period, so the prompts below are judged on
  // their own merits. The grace-period tests say otherwise out loud.
  createdAt: new Date('2025-01-15T00:00:00.000Z'),
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
  // A sole owner, as every vehicle starts. The fan-out tests add members.
  members: [{ userId: 'u1', role: VehicleRole.owner }] as { userId: string; role: VehicleRole }[],
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
  auditEvent: { findFirst: vi.fn() },
  warranty: { findMany: vi.fn() },
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
  prisma.warranty.findMany.mockResolvedValue([]);
  // An active owner by default — a recent audited action — so prompts go to
  // every channel unless a test is specifically about dormancy.
  prisma.auditEvent.findFirst.mockResolvedValue({ id: 'evt-recent' });
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

describe('MaintenanceAlertService date reminders', () => {
  let service: MaintenanceAlertService;

  /** NOW is 2026-09-08, so the seven-day window closes on the 15th. */
  const reminder = (overrides: Record<string, unknown> = {}) => ({
    id: 'rem-1',
    vehicleId: 'v1',
    title: 'Insurance renewal',
    dueDate: new Date('2026-09-11T00:00:00.000Z'),
    dueOdometer: null,
    notes: null,
    ...overrides,
  });

  /**
   * Resolves reminders the way Prisma would, applying the `where` the engine
   * actually sends. A plain `mockResolvedValue` hands back rows the database
   * was never asked for, so a date-only assertion would still pass with the
   * `dueDate` clause deleted from the query.
   */
  type ReminderWhere = {
    status?: { not?: string };
    dueDate?: { not?: null };
    dueOdometer?: { not?: null };
    OR?: { dueDate?: { not?: null }; dueOdometer?: { not?: null } }[];
  };

  const findManyHonouringWhere = (rows: ReturnType<typeof reminder>[]) => {
    const matchesTiming = (row: ReturnType<typeof reminder>, clause: ReminderWhere) => {
      if ('dueDate' in clause && row.dueDate == null) return false;
      if ('dueOdometer' in clause && row.dueOdometer == null) return false;
      return true;
    };

    prisma.reminder.findMany.mockImplementation((args: unknown) => {
      const where = ((args as { where?: ReminderWhere }).where ?? {}) as ReminderWhere;

      return Promise.resolve(
        rows.filter((row) => {
          const status = (row as { status?: string }).status ?? 'upcoming';
          if (where.status?.not === status) return false;
          if (where.OR) return where.OR.some((clause) => matchesTiming(row, clause));
          return matchesTiming(row, where);
        }),
      );
    });
  };

  const reminderAlerts = () =>
    notify.raise.mock.calls
      .filter(([, , kind]) => kind === 'reminder-due' || kind === 'reminder-overdue')
      .map(([, , kind, payload]) => ({ kind, payload }));

  beforeEach(() => {
    service = buildService();
    intervals.resolveForVehicle.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('alerts on a date-only reminder inside the seven-day window', async () => {
    // The case the engine was blind to: no dueOdometer, so the old query never
    // returned the row and no email or push ever went out.
    findManyHonouringWhere([reminder()]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      {
        kind: 'reminder-due',
        payload: expect.objectContaining({
          reminderId: 'rem-1',
          basis: 'date',
          daysUntilDue: 3,
          dueDate: new Date('2026-09-11T00:00:00.000Z'),
        }),
      },
    ]);
  });

  it('counts the last day of the window as due and the first day past it as nothing', async () => {
    findManyHonouringWhere([
      reminder({ id: 'inside', dueDate: new Date('2026-09-15T00:00:00.000Z') }),
      reminder({ id: 'outside', dueDate: new Date('2026-09-16T00:00:00.000Z') }),
    ]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      { kind: 'reminder-due', payload: expect.objectContaining({ reminderId: 'inside' }) },
    ]);
  });

  it('treats a reminder due today as due, not overdue', async () => {
    // Same boundary as `RemindersService.getDueDateStatus`, so the notification
    // cannot contradict the status shown on the reminder itself.
    findManyHonouringWhere([reminder({ dueDate: new Date('2026-09-08T00:00:00.000Z') })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      { kind: 'reminder-due', payload: expect.objectContaining({ daysUntilDue: 0 }) },
    ]);
  });

  it('raises overdue, and only overdue, once the date is past', async () => {
    findManyHonouringWhere([reminder({ dueDate: new Date('2026-09-02T00:00:00.000Z') })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      {
        kind: 'reminder-overdue',
        payload: expect.objectContaining({ basis: 'date', daysUntilDue: -6 }),
      },
    ]);
    expect(kindsRaised()).not.toContain('reminder-due');
  });

  it('raises the same payload on a second run, so the dedup key cannot move', async () => {
    // The engine raises again every morning; `NotifyService` is what collapses
    // the repeat into the existing unread row, and it can only do that while
    // the dedup key stays put. Payload equality is what guarantees it here.
    findManyHonouringWhere([reminder()]);

    await service.runAlertChecks('v1');
    await service.runAlertChecks('v1');

    const raised = reminderAlerts();
    expect(raised).toHaveLength(2);
    expect(new ReminderDueTemplate().dedupKey(raised[0].payload)).toBe(
      new ReminderDueTemplate().dedupKey(raised[1].payload),
    );
  });

  it('says nothing about a completed reminder', async () => {
    findManyHonouringWhere([reminder({ status: 'completed' })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([]);
  });

  it('leaves the dated tyre walk-around to the measurements too', async () => {
    findManyHonouringWhere([
      reminder({
        title: 'Tyre tread & pressure check',
        dueDate: new Date('2026-09-02T00:00:00.000Z'),
        notes: '[catalog:tyre_inspection]',
      }),
    ]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([]);
  });

  it('raises one notification, not two, for a reminder carrying both timings', async () => {
    // Due in three days and 200 km short of its mark: two true statements about
    // one task, and the owner should hear it once.
    findManyHonouringWhere([reminder({ dueOdometer: 40_200 })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toHaveLength(1);
  });

  it('lets the missed half of a two-timing reminder win', async () => {
    // The odometer is comfortably inside its window while the date has already
    // gone. "You have missed this" is the truer sentence.
    findManyHonouringWhere([
      reminder({ dueDate: new Date('2026-09-02T00:00:00.000Z'), dueOdometer: 40_200 }),
    ]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      {
        kind: 'reminder-overdue',
        payload: expect.objectContaining({ basis: 'date', daysUntilDue: -6 }),
      },
    ]);
  });

  it('still reports a distant date reminder by its odometer when that is what is close', async () => {
    findManyHonouringWhere([
      reminder({ dueDate: new Date('2026-12-01T00:00:00.000Z'), dueOdometer: 40_200 }),
    ]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      {
        kind: 'reminder-due',
        payload: expect.objectContaining({ basis: 'odometer', remainingDistanceKm: 200 }),
      },
    ]);
  });

  it('still alerts on an odometer-only reminder exactly as before', async () => {
    findManyHonouringWhere([reminder({ dueDate: null, dueOdometer: 35_000 })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([
      {
        kind: 'reminder-overdue',
        payload: expect.objectContaining({ basis: 'odometer', remainingDistanceKm: -5_000 }),
      },
    ]);
  });

  it('says nothing about a reminder that carries neither a date nor an odometer', async () => {
    findManyHonouringWhere([reminder({ dueDate: null, dueOdometer: null })]);

    await service.runAlertChecks('v1');

    expect(reminderAlerts()).toEqual([]);
  });
});

describe('MaintenanceAlertService cold-start prompts', () => {
  let service: MaintenanceAlertService;

  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  /** This vehicle is old enough for both prompts and has told the app nothing. */
  const untold = (overrides: Partial<typeof VEHICLE> = {}) => ({ ...VEHICLE, ...overrides });

  /**
   * Audit events for the owner, answered the way Postgres would apply the
   * engine's `where`. A stub that returned "active" or "dormant" outright
   * would pass with the 60-day window or the failed-login exclusion deleted.
   */
  const auditTrail = (events: { action: string; occurredAt: Date; actorUserId?: string }[]) => {
    prisma.auditEvent.findFirst.mockImplementation((args: unknown) => {
      const where = (
        args as {
          where: { actorUserId: string; occurredAt: { gte: Date }; action: { not: string } };
        }
      ).where;
      const match = events.find(
        (event) =>
          (event.actorUserId ?? 'u1') === where.actorUserId &&
          event.occurredAt >= where.occurredAt.gte &&
          event.action !== where.action.not,
      );
      return Promise.resolve(match ? { id: 'evt' } : null);
    });
  };

  /** The prompts raised this run, with the options they were raised under. */
  const prompts = () =>
    notify.raise.mock.calls
      .filter(
        ([, , kind, payload]) =>
          (kind === 'tyre-uninspected' && payload.reason === 'untracked') ||
          (kind === 'service-baseline-unknown' && payload.scope === 'vehicle'),
      )
      .map(([, , kind, , options]) => ({ kind, options }));

  beforeEach(() => {
    service = buildService();
    intervals.resolveForVehicle.mockResolvedValue({});
    // No tyres on file: the `untracked` prompt's precondition.
    tyres.getAlertState.mockResolvedValue(alertState({ conditions: [], lastObservation: null }));
    auditTrail([{ action: 'vehicle.updated', occurredAt: daysAgo(2) }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('new vehicles', () => {
    it('asks nothing about a vehicle added three days ago, however old it is', async () => {
      // 40 000 km is far past both prompt thresholds. The owner may be about to
      // enter exactly what the prompts would ask for.
      prisma.vehicle.findUnique.mockResolvedValue(untold({ createdAt: daysAgo(3) }));

      await service.runAlertChecks('v1');

      expect(prompts()).toEqual([]);
    });

    it('asks once the vehicle is eight days old', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(untold({ createdAt: daysAgo(8) }));

      await service.runAlertChecks('v1');

      expect(prompts().map((prompt) => prompt.kind)).toEqual([
        'service-baseline-unknown',
        'tyre-uninspected',
      ]);
    });

    it('still says what is actually wrong with a brand-new vehicle', async () => {
      // A worn tyre is a fact, not a question, and waits for nobody's setup.
      prisma.vehicle.findUnique.mockResolvedValue(untold({ createdAt: daysAgo(1) }));
      tyres.getAlertState.mockResolvedValue(
        alertState({
          conditions: [condition({ level: 'illegal', reason: 'tread', treadDepthMm: 1.2 })],
        }),
      );

      await service.runAlertChecks('v1');

      expect(kindsRaised()).toContain('tyre-worn');
    });
  });

  describe('dormant owners', () => {
    it('keeps a prompt in the app for someone idle for 61 days', async () => {
      auditTrail([{ action: 'vehicle.updated', occurredAt: daysAgo(61) }]);

      await service.runAlertChecks('v1');

      expect(prompts()).toHaveLength(2);
      for (const prompt of prompts()) {
        expect(prompt.options).toEqual(expect.objectContaining({ inAppOnly: true }));
      }
    });

    it('delivers everywhere to someone who acted 59 days ago', async () => {
      auditTrail([{ action: 'vehicle.updated', occurredAt: daysAgo(59) }]);

      await service.runAlertChecks('v1');

      expect(prompts()).toHaveLength(2);
      for (const prompt of prompts()) {
        expect(prompt.options).toEqual(expect.objectContaining({ inAppOnly: false }));
      }
    });

    it('counts signing in as being around', async () => {
      auditTrail([{ action: 'auth.login_succeeded', occurredAt: daysAgo(5) }]);

      await service.runAlertChecks('v1');

      expect(prompts()[0].options).toEqual(expect.objectContaining({ inAppOnly: false }));
    });

    it('does not let a stranger’s failed sign-ins make an idle account look active', async () => {
      // A failed login is recorded against the account it targeted.
      auditTrail([
        { action: 'auth.login_failed', occurredAt: daysAgo(1) },
        { action: 'vehicle.updated', occurredAt: daysAgo(200) },
      ]);

      await service.runAlertChecks('v1');

      expect(prompts()[0].options).toEqual(expect.objectContaining({ inAppOnly: true }));
    });

    it('judges the recipient, not whoever happens to act on the vehicle', async () => {
      // Someone else's recent activity says nothing about whether the owner is
      // around — the distinction that matters once alerts reach every member.
      auditTrail([{ action: 'vehicle.updated', occurredAt: daysAgo(1), actorUserId: 'u2' }]);

      await service.runAlertChecks('v1');

      expect(prompts()[0].options).toEqual(expect.objectContaining({ inAppOnly: true }));
    });

    it('never mutes a condition alert for a dormant owner', async () => {
      auditTrail([]);
      tyres.getAlertState.mockResolvedValue(
        alertState({
          conditions: [condition({ level: 'illegal', reason: 'tread', treadDepthMm: 1.2 })],
        }),
      );

      await service.runAlertChecks('v1');

      const worn = notify.raise.mock.calls.find(([, , kind]) => kind === 'tyre-worn');
      expect(worn).toBeDefined();
      expect(worn?.[4]).toBeUndefined();
    });
  });

  describe('repetition', () => {
    it('asks for a 90-day cooldown on both prompts', async () => {
      await service.runAlertChecks('v1');

      expect(prompts()).toEqual([
        {
          kind: 'service-baseline-unknown',
          options: expect.objectContaining({ cooldownDays: 90 }),
        },
        { kind: 'tyre-uninspected', options: expect.objectContaining({ cooldownDays: 90 }) },
      ]);
    });

    it('leaves the category-scope baseline alert exactly as it was', async () => {
      // The owner answered "unknown" for one category: an answer, not silence,
      // and not one of the prompts this policy is about.
      intervals.resolveForVehicle.mockResolvedValue({
        brake_pads: { km: 30_000, months: 24, source: 'default' },
      });
      prisma.vehicle.findUnique.mockResolvedValue(
        untold({
          createdAt: daysAgo(1),
          serviceBaselines: [
            {
              category: 'brake_pads',
              status: ServiceBaselineStatus.unknown,
              lastDoneOdometer: null,
            },
          ],
        }),
      );
      auditTrail([]);

      await service.runAlertChecks('v1');

      const categoryScope = notify.raise.mock.calls.filter(
        ([, , kind, payload]) =>
          kind === 'service-baseline-unknown' && payload.scope === 'category',
      );
      expect(categoryScope).toHaveLength(1);
      expect(categoryScope[0][4]).toBeUndefined();
    });

    it('leaves the stale-tyre reminder exactly as it was', async () => {
      // Tyres are on file, just not measured lately. That is not a cold-start
      // question about a vehicle nobody has described.
      prisma.vehicle.findUnique.mockResolvedValue(untold({ createdAt: daysAgo(1) }));
      tyres.getAlertState.mockResolvedValue(
        alertState({
          conditions: [condition({})],
          lastObservation: { at: daysAgo(40), odometer: 33_500 },
        }),
      );
      auditTrail([]);

      await service.runAlertChecks('v1');

      const stale = notify.raise.mock.calls.filter(
        ([, , kind, payload]) => kind === 'tyre-uninspected' && payload.reason === 'stale',
      );
      expect(stale).toHaveLength(1);
      expect(stale[0][4]).toBeUndefined();
    });
  });
});

describe('MaintenanceAlertService member fan-out', () => {
  let service: MaintenanceAlertService;

  const OWNER = { userId: 'u1', role: VehicleRole.owner };
  const EDITOR = { userId: 'u2', role: VehicleRole.editor };
  const VIEWER = { userId: 'u3', role: VehicleRole.viewer };

  const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

  /**
   * One run that trips every kind the engine raises outside the cold-start
   * prompts, each exactly once: an overdue oil change, a brake-pad history the
   * owner said they do not know, a reminder three days out, an expiring policy,
   * an expiring accessory warranty, one worn and one aged tyre, and a tyre
   * reading gone stale.
   */
  function everyAlertOnce(members: { userId: string; role: VehicleRole }[]) {
    prisma.vehicle.findUnique.mockResolvedValue({
      ...VEHICLE,
      maintenanceRecords: [{ category: 'engine_oil', odometer: 34_000 }],
      serviceBaselines: [
        { category: 'brake_pads', status: ServiceBaselineStatus.unknown, lastDoneOdometer: null },
      ],
      members,
    });
    intervals.resolveForVehicle.mockResolvedValue({
      engine_oil: { km: 5_000 },
      brake_pads: { km: 20_000 },
    });
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        vehicleId: 'v1',
        title: 'Insurance renewal',
        dueDate: daysFromNow(3),
        dueOdometer: null,
        notes: null,
      },
    ]);
    documents.findExpiring.mockResolvedValue([
      { id: 'doc-1', vehicleId: 'v1', kind: 'insurance', endDate: daysFromNow(5) },
    ]);
    accessories.findExpiringWarranties.mockResolvedValue([
      { id: 'acc-1', vehicleId: 'v1', name: 'Dashcam', warrantyExpiresAt: daysFromNow(10) },
    ]);
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [
          condition({ tyreId: 'tyre-1', level: 'illegal', reason: 'tread', treadDepthMm: 1.4 }),
          condition({ tyreId: 'tyre-2', level: 'replace', reason: 'age', ageYears: 6.4 }),
        ],
        lastObservation: { at: new Date('2026-01-01T00:00:00.000Z'), odometer: 30_000 },
      }),
    );
  }

  /** Who each kind was raised to this run, in raise order. */
  const recipientsByKind = () => {
    const byKind = new Map<string, string[]>();
    for (const [userId, , kind] of notify.raise.mock.calls) {
      byKind.set(kind, [...(byKind.get(kind) ?? []), userId]);
    }
    return Object.fromEntries(byKind);
  };

  const NEWS_KINDS = [
    'maintenance-overdue',
    'reminder-due',
    'document-expiring',
    'accessory-warranty-expiring',
    'tyre-worn',
    'tyre-aged',
  ];
  const ASKING_KINDS = ['service-baseline-unknown', 'tyre-uninspected'];

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tells every member of a shared vehicle what is due or wrong with it', async () => {
    everyAlertOnce([OWNER, EDITOR, VIEWER]);

    await service.runAlertChecks('v1');

    const recipients = recipientsByKind();
    for (const kind of NEWS_KINDS) {
      expect(recipients[kind], kind).toEqual(['u1', 'u2', 'u3']);
    }
  });

  it('asks only the members who can log an answer', async () => {
    // Both of these ask the reader to record something. A viewer cannot, and
    // since viewers stopped seeing the controls, could not even try.
    everyAlertOnce([OWNER, EDITOR, VIEWER]);

    await service.runAlertChecks('v1');

    const recipients = recipientsByKind();
    for (const kind of ASKING_KINDS) {
      expect(recipients[kind], kind).toEqual(['u1', 'u2']);
    }
  });

  it('raises to a sole owner exactly as it did before sharing', async () => {
    everyAlertOnce([OWNER]);

    await service.runAlertChecks('v1');

    const recipients = recipientsByKind();
    for (const kind of [...NEWS_KINDS, ...ASKING_KINDS]) {
      expect(recipients[kind], kind).toEqual(['u1']);
    }
  });

  it('falls back to the owner column for a vehicle with no member rows', async () => {
    everyAlertOnce([]);

    await service.runAlertChecks('v1');

    expect(notify.raise.mock.calls.map(([userId]) => userId)).toEqual(
      Array(NEWS_KINDS.length + ASKING_KINDS.length).fill('u1'),
    );
  });

  it('follows the membership as it is on each run', async () => {
    everyAlertOnce([OWNER, EDITOR, VIEWER]);
    await service.runAlertChecks('v1');

    // The viewer is removed and someone new joins as a viewer before the next run.
    notify.raise.mockClear();
    everyAlertOnce([OWNER, EDITOR, { userId: 'u4', role: VehicleRole.viewer }]);
    await service.runAlertChecks('v1');

    const raisedTo = new Set(notify.raise.mock.calls.map(([userId]) => userId));
    expect(raisedTo.has('u3')).toBe(false);
    expect(recipientsByKind()['maintenance-overdue']).toEqual(['u1', 'u2', 'u4']);
  });

  it('reads the members in the vehicle query, with no lookup of its own', async () => {
    everyAlertOnce([OWNER, EDITOR, VIEWER]);

    await service.runAlertChecks('v1');

    // The Prisma stub has no vehicleMember model, so a separate lookup would throw.
    expect(prisma.vehicle.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          members: { select: { userId: true, role: true } },
        }),
      }),
    );
  });

  describe('cold-start prompts', () => {
    const coldStart = (members: { userId: string; role: VehicleRole }[]) => {
      prisma.vehicle.findUnique.mockResolvedValue({ ...VEHICLE, members });
      intervals.resolveForVehicle.mockResolvedValue({});
      tyres.getAlertState.mockResolvedValue(alertState({ conditions: [], lastObservation: null }));
    };

    it('asks the owner and editors, never the viewer', async () => {
      coldStart([OWNER, EDITOR, VIEWER]);

      await service.runAlertChecks('v1');

      expect(recipientsByKind()).toEqual({
        'service-baseline-unknown': ['u1', 'u2'],
        'tyre-uninspected': ['u1', 'u2'],
      });
    });

    it('judges dormancy for each member separately', async () => {
      coldStart([OWNER, EDITOR]);
      // The owner has been active; the editor has not been seen in months.
      prisma.auditEvent.findFirst.mockImplementation((args: unknown) => {
        const { actorUserId } = (args as { where: { actorUserId: string } }).where;
        return Promise.resolve(actorUserId === 'u1' ? { id: 'evt-recent' } : null);
      });

      await service.runAlertChecks('v1');

      const optionsFor = (userId: string) =>
        notify.raise.mock.calls
          .filter(([raisedTo, , kind]) => raisedTo === userId && kind === 'tyre-uninspected')
          .map(([, , , , options]) => options);

      expect(optionsFor('u1')).toEqual([expect.objectContaining({ inAppOnly: false })]);
      expect(optionsFor('u2')).toEqual([expect.objectContaining({ inAppOnly: true })]);
    });
  });
});

/**
 * The engine against the real NotifyService and templates, over a notification
 * table that enforces the unread-dedup index the way Postgres does. The engine
 * tests above stub `raise`, so they cannot say what a second run leaves behind.
 */
describe('MaintenanceAlertService re-runs with several members', () => {
  type Row = { id: string; userId: string; dedupKey: string; kind: string; isRead: boolean };

  function notificationTable() {
    const rows: Row[] = [];
    return {
      rows,
      notification: {
        create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'isRead'> }) => {
          const clash = rows.some(
            (row) => row.userId === data.userId && row.dedupKey === data.dedupKey && !row.isRead,
          );
          if (clash) {
            throw new PrismaClientKnownRequestError('Unique constraint failed', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
          const row = { ...data, id: `n${rows.length + 1}`, isRead: false };
          rows.push(row);
          return row;
        }),
        findFirst: vi.fn(async ({ where }: { where: { userId: string; dedupKey: string } }) => {
          return (
            rows.find(
              (row) =>
                row.userId === where.userId && row.dedupKey === where.dedupKey && !row.isRead,
            ) ?? null
          );
        }),
      },
    };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves each member one unread copy of each alert, however often it runs', async () => {
    buildService();
    const table = notificationTable();
    const notifyService = new NotifyService(
      table as never,
      [
        new MaintenanceOverdueTemplate(),
        new ReminderDueTemplate(),
        new TyreWornTemplate(),
        new ServiceBaselineUnknownTemplate(),
      ] as never,
      [],
    );
    const engine = new MaintenanceAlertService(
      prisma as never,
      insights as never,
      notifyService,
      documents as never,
      intervals as never,
      accessories as never,
      tyres as never,
    );

    prisma.vehicle.findUnique.mockResolvedValue({
      ...VEHICLE,
      maintenanceRecords: [{ category: 'engine_oil', odometer: 34_000 }],
      serviceBaselines: [
        { category: 'brake_pads', status: ServiceBaselineStatus.unknown, lastDoneOdometer: null },
      ],
      members: [
        { userId: 'u1', role: VehicleRole.owner },
        { userId: 'u2', role: VehicleRole.editor },
        { userId: 'u3', role: VehicleRole.viewer },
      ],
    });
    intervals.resolveForVehicle.mockResolvedValue({
      engine_oil: { km: 5_000 },
      brake_pads: { km: 20_000 },
    });
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'rem-1',
        vehicleId: 'v1',
        title: 'Insurance renewal',
        dueDate: new Date('2026-09-11T00:00:00.000Z'),
        dueOdometer: null,
        notes: null,
      },
    ]);
    tyres.getAlertState.mockResolvedValue(
      alertState({
        conditions: [condition({ level: 'illegal', reason: 'tread', treadDepthMm: 1.4 })],
      }),
    );

    await engine.runAlertChecks('v1');
    const afterFirstRun = table.rows.length;
    await engine.runAlertChecks('v1');
    await engine.runAlertChecks('v1');

    // Three news alerts to three members, one question to the two who can answer it.
    expect(afterFirstRun).toBe(3 * 3 + 2);
    expect(table.rows).toHaveLength(afterFirstRun);
    const copies = new Map<string, number>();
    for (const row of table.rows) {
      const key = `${row.userId} ${row.dedupKey}`;
      copies.set(key, (copies.get(key) ?? 0) + 1);
    }
    expect([...copies.values()].every((count) => count === 1)).toBe(true);
  });
});

describe('MaintenanceAlertService warranty distance', () => {
  let service: MaintenanceAlertService;

  /** A warranty on a vehicle at 40 000 km (the fixture's predicted odometer). */
  const warranty = (overrides: Record<string, unknown> = {}) => ({
    id: 'wty-1',
    vehicleId: 'v1',
    provider: 'Hyundai',
    type: 'Manufacturer',
    warrantyNumber: null,
    startDate: new Date('2024-01-01T00:00:00.000Z'),
    endDate: new Date('2027-01-01T00:00:00.000Z'),
    endOdometer: 40_400,
    notes: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    service = buildService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns as the vehicle comes within the odometer window of the limit', async () => {
    prisma.warranty.findMany.mockResolvedValue([warranty()]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([
      {
        warranty: {
          id: 'wty-1',
          vehicleId: 'v1',
          provider: 'Hyundai',
          type: 'Manufacturer',
          endOdometer: 40_400,
        },
        remainingKm: 400,
      },
    ]);
  });

  it('says so once the limit has been passed', async () => {
    prisma.warranty.findMany.mockResolvedValue([warranty({ endOdometer: 39_000 })]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([
      expect.objectContaining({ remainingKm: -1_000 }),
    ]);
  });

  it('stays quiet while the limit is further off than the window', async () => {
    prisma.warranty.findMany.mockResolvedValue([warranty({ endOdometer: 60_000 })]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([]);
  });

  it('leaves a warranty with only a date to the expiry alert, as before', async () => {
    prisma.warranty.findMany.mockResolvedValue([warranty({ endOdometer: null })]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([]);
  });

  it('watches the extended warranty, not the manufacturer one it took over from', async () => {
    prisma.warranty.findMany.mockResolvedValue([
      warranty({ id: 'wty-old', endOdometer: 39_000, endDate: new Date('2025-12-31') }),
      warranty({
        id: 'wty-extended',
        type: 'Extended',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endOdometer: 100_000,
      }),
    ]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([]);
  });

  it('says nothing of a warranty whose date has already run out', async () => {
    prisma.warranty.findMany.mockResolvedValue([
      warranty({ endDate: new Date('2026-01-01T00:00:00.000Z') }),
    ]);

    await service.runAlertChecks('v1');

    expect(alertsOfKind('warranty-odometer')).toEqual([]);
  });

  it('reaches everyone the vehicle is shared with, viewers included', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({
      ...VEHICLE,
      members: [
        { userId: 'u1', role: VehicleRole.owner },
        { userId: 'u2', role: VehicleRole.viewer },
      ],
    });
    prisma.warranty.findMany.mockResolvedValue([warranty()]);

    await service.runAlertChecks('v1');

    const recipients = notify.raise.mock.calls
      .filter(([, , kind]) => kind === 'warranty-odometer')
      .map(([userId]) => userId);
    expect(recipients.sort()).toEqual(['u1', 'u2']);
  });
});

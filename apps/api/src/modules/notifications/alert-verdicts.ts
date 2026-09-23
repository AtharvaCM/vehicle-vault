// The Prisma enum rather than the shared one, as in the engine: the baselines
// arrive straight off a Prisma query on both sides.
import { ServiceBaselineStatus } from '@prisma/client';
import {
  SERVICE_HISTORY_PROMPT_KM,
  TYRE_INSPECTION_INTERVAL_KM,
  TYRE_INSPECTION_INTERVAL_MONTHS,
  TYRE_TRACKING_PROMPT_KM,
  VEHICLE_AGE_PROMPT_YEARS,
  type MaintenanceCategory,
  type VehicleServiceIntervalMap,
} from '@vehicle-vault/shared';

// Pure functions, not a provider: importing them does not make the
// notifications module depend on the reminders module, which would close a
// cycle (reminders → notifications → tyres).
import { TYRE_INSPECTION_SLUG } from '../reminders/service-schedule-catalog';
import type { VehicleTyreAlertState } from '../tyres/tyres.service';
import type { AlertKind, AlertPayloads } from './types';

/**
 * What the alert engine concludes about a vehicle, before anyone is told.
 *
 * The engine turns these verdicts into notifications and the dashboard's
 * attention queue turns them into rows. Both read them from here, so the bell
 * and the queue cannot disagree about what is wrong with a vehicle. Who hears
 * about a verdict, and how often, stays with each of them: that is delivery,
 * not diagnosis.
 *
 * Pure functions over rows the caller has already loaded. The engine reads one
 * vehicle at a time and the dashboard every vehicle a user can see, so neither
 * can share the other's queries, only the conclusions drawn from them.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A vehicle this new is still being set up; asking what its owner has not entered yet is premature. */
export const PROMPT_NEW_VEHICLE_GRACE_DAYS = 7;

/** One alert the engine would raise: its kind, and the payload it would carry. */
export type AlertVerdict<K extends AlertKind = AlertKind> = {
  [Kind in K]: { kind: Kind; payload: AlertPayloads[Kind] };
}[K];

/**
 * The alerts that ask their reader to record something — service history, a
 * tyre reading. A viewer cannot, and no longer sees the controls to try, so
 * these go to the members who can. Every other alert is news about the vehicle
 * and goes to all of them.
 */
export const EDITOR_ONLY_KINDS: ReadonlySet<AlertKind> = new Set<AlertKind>([
  'service-baseline-unknown',
  'tyre-uninspected',
]);

/**
 * The tyre walk-around reminder is left to the measurements. Both would
 * otherwise nag about one thing, and they would disagree: a reminder goes
 * overdue when nobody ticked a box, while `tyre-uninspected` goes stale when
 * nobody actually looked. Only the second is true about the tyres. Someone who
 * inspects and forgets to tick is left alone; someone who ticks without
 * inspecting is not.
 */
export function isAlertedFromMeasurements(reminder: { catalogSlug?: string | null }): boolean {
  return reminder.catalogSlug === TYRE_INSPECTION_SLUG;
}

/** The vehicle facts the two cold-start questions turn on. */
export type VerdictVehicle = {
  id: string;
  year: number;
  odometer: number;
  createdAt: Date;
};

function monthsBefore(date: Date, months: number): Date {
  const shifted = new Date(date);
  shifted.setMonth(shifted.getMonth() - months);
  return shifted;
}

/**
 * A vehicle added in the last week is still being set up. Asking its owner
 * about tyres or service history they may be about to enter is noise, so the
 * two cold-start questions wait. Nothing that is actually wrong waits.
 */
export function isStillBeingSetUp(vehicle: Pick<VerdictVehicle, 'createdAt'>, now: Date): boolean {
  return vehicle.createdAt.getTime() > now.getTime() - PROMPT_NEW_VEHICLE_GRACE_DAYS * MS_PER_DAY;
}

/**
 * Whether a vehicle has enough history behind it for the app's silence about
 * that history to be misleading — enough distance covered, or old enough that
 * wear items have aged regardless of use. Below both, a vehicle really is
 * young and original and asking is noise.
 *
 * The distance threshold differs per question (tyres and service history are
 * not due at the same point); the age one does not, because it is the same
 * observation in both cases: the calendar wears a vehicle that never moves.
 */
export function isOldEnoughToAsk(
  vehicle: Pick<VerdictVehicle, 'year'>,
  odometer: number,
  promptKm: number,
  now: Date,
): boolean {
  const vehicleAgeYears = now.getFullYear() - vehicle.year;
  return odometer >= promptKm || vehicleAgeYears >= VEHICLE_AGE_PROMPT_YEARS;
}

// ---------------------------------------------------------------------------
// Tyres
// ---------------------------------------------------------------------------

export type TyreVerdict = AlertVerdict<'tyre-worn' | 'tyre-aged' | 'tyre-uninspected'>;

/**
 * Condition verdicts come one per tyre, the inspection question one per
 * vehicle. The resolver grades each tyre once — the worse of tread and age — so
 * a tyre yields at most one of `tyre-worn` / `tyre-aged`, and a set of four
 * cannot produce eight verdicts.
 */
export function tyreVerdicts(
  vehicle: VerdictVehicle,
  state: VehicleTyreAlertState,
  now: Date,
): TyreVerdict[] {
  const verdicts: TyreVerdict[] = [];

  for (const condition of state.conditions) {
    // `unknown` means nothing has been measured, which the inspection question
    // below answers. Calling it worn would invent a reading.
    if (condition.level === 'healthy' || condition.level === 'unknown') continue;

    if (condition.reason === 'tread') {
      verdicts.push({
        kind: 'tyre-worn',
        payload: {
          vehicleId: vehicle.id,
          tyreId: condition.tyreId,
          position: condition.position,
          level: condition.level,
          summary: condition.summary,
          treadDepthMm: condition.treadDepthMm,
        },
      });
    } else if (condition.reason === 'age' && condition.level !== 'illegal') {
      verdicts.push({
        kind: 'tyre-aged',
        payload: {
          vehicleId: vehicle.id,
          tyreId: condition.tyreId,
          position: condition.position,
          level: condition.level,
          summary: condition.summary,
          ageYears: condition.ageYears,
        },
      });
    }
  }

  const inspection = tyreInspectionVerdict(vehicle, state, now);
  if (inspection) verdicts.push(inspection);

  return verdicts;
}

/**
 * The app cannot see this vehicle's tyres: none are on file (`untracked`, a
 * cold-start question) or nobody has measured them lately (`stale`, a fact
 * about readings the owner already keeps, so it does not wait out the grace).
 */
function tyreInspectionVerdict(
  vehicle: VerdictVehicle,
  state: VehicleTyreAlertState,
  now: Date,
): AlertVerdict<'tyre-uninspected'> | null {
  if (state.conditions.length === 0) {
    if (isStillBeingSetUp(vehicle, now)) return null;
    if (!isOldEnoughToAsk(vehicle, state.vehicleOdometer, TYRE_TRACKING_PROMPT_KM, now)) {
      return null;
    }

    return {
      kind: 'tyre-uninspected',
      payload: { vehicleId: vehicle.id, odometer: state.vehicleOdometer, reason: 'untracked' },
    };
  }

  // Tyres are tracked but none of them is on the road (a lone spare). There is
  // no distance to measure staleness against and nothing useful to ask for.
  if (state.lastObservation == null) return null;

  const kmSinceLastCheck = Math.max(0, state.vehicleOdometer - state.lastObservation.odometer);
  const staleByDistance = kmSinceLastCheck >= TYRE_INSPECTION_INTERVAL_KM;
  const staleByTime =
    state.lastObservation.at <= monthsBefore(now, TYRE_INSPECTION_INTERVAL_MONTHS);
  if (!staleByDistance && !staleByTime) return null;

  const daysSinceLastCheck = Math.max(
    0,
    Math.floor((now.getTime() - state.lastObservation.at.getTime()) / MS_PER_DAY),
  );

  return {
    kind: 'tyre-uninspected',
    payload: {
      vehicleId: vehicle.id,
      odometer: state.vehicleOdometer,
      reason: 'stale',
      kmSinceLastCheck,
      daysSinceLastCheck,
    },
  };
}

// ---------------------------------------------------------------------------
// Service history
// ---------------------------------------------------------------------------

/** A confirmed service record, as far as history is concerned. Drafts are never evidence. */
export type HistoryRecord = { category: string; odometer: number };

export type HistoryBaseline = {
  category: string;
  status: ServiceBaselineStatus;
  lastDoneOdometer: number | null;
};

export type ServiceHistoryInput = {
  vehicle: VerdictVehicle;
  intervals: VehicleServiceIntervalMap;
  /** Confirmed records only. */
  confirmedRecords: readonly HistoryRecord[];
  baselines: readonly HistoryBaseline[];
};

/**
 * Where a category's distance interval is measured from, or why it cannot be.
 *
 * The cases are genuinely different and used to collapse into one:
 *
 * - A **logged service** is a measurement and always wins.
 * - A **baseline reading** is what the owner told us at onboarding. Second
 *   best, and the whole point of the table.
 * - A baseline of **`unknown`** is an owner who was asked and said they did
 *   not know. That earns an alert, not silence — silence is what let a bike
 *   at 40 000 km look like it had just had everything done.
 * - A baseline that knows **only a date** is `unmeasurable`: the distance
 *   arithmetic cannot use it, and inventing an odometer for that date from the
 *   mileage forecast would let a projection decide a service is overdue.
 *   Month-based intervals surface through the forecast, not alerts.
 * - **No baseline row** means nobody has been asked. Every vehicle predating
 *   the baseline table is in this state, so it keeps the historical fallback
 *   (measure from the odometer on the vehicle) rather than being retroactively
 *   declared unknown and alerted about, category by category.
 */
export type LastDone =
  | { kind: 'measured'; odometer: number }
  | { kind: 'declared-unknown' }
  | { kind: 'unmeasurable' };

export type DistanceInterval = {
  category: MaintenanceCategory;
  intervalKm: number;
  lastDone: LastDone;
};

function lastDoneFor(
  lastRecordOdometer: number | null,
  baseline: HistoryBaseline | null,
  vehicleOdometer: number,
): LastDone {
  if (lastRecordOdometer != null) return { kind: 'measured', odometer: lastRecordOdometer };
  if (baseline?.lastDoneOdometer != null) {
    return { kind: 'measured', odometer: baseline.lastDoneOdometer };
  }
  if (baseline?.status === ServiceBaselineStatus.unknown) return { kind: 'declared-unknown' };
  if (baseline) return { kind: 'unmeasurable' };

  return { kind: 'measured', odometer: vehicleOdometer || 0 };
}

/**
 * Every category the engine times by distance, with where its interval is
 * measured from. The latest confirmed record per category is the one with the
 * highest odometer, whatever order the rows arrive in.
 */
export function distanceIntervals(
  input: Omit<ServiceHistoryInput, 'vehicle'> & {
    vehicle: Pick<VerdictVehicle, 'odometer'>;
  },
): DistanceInterval[] {
  const lastRecordOdometer = new Map<string, number>();
  for (const record of input.confirmedRecords) {
    const current = lastRecordOdometer.get(record.category);
    if (current === undefined || record.odometer > current) {
      lastRecordOdometer.set(record.category, record.odometer);
    }
  }
  const baselineByCategory = new Map(input.baselines.map((row) => [row.category, row]));

  return Object.entries(input.intervals).flatMap(([category, interval]) => {
    if (interval?.km == null) return [];

    return [
      {
        category: category as MaintenanceCategory,
        intervalKm: interval.km,
        lastDone: lastDoneFor(
          lastRecordOdometer.get(category) ?? null,
          baselineByCategory.get(category) ?? null,
          input.vehicle.odometer,
        ),
      },
    ];
  });
}

/**
 * What the app does not know about a vehicle's service history.
 *
 * Once for the whole vehicle when it has been told nothing at all — no
 * confirmed records, no baselines — and enough distance or years have passed
 * for that silence to mislead. Every category is in the same state then, and
 * ten verdicts would say one thing. A vehicle with a single logged service is
 * already telling us something and is not asked.
 *
 * Otherwise once per distance-timed category whose owner has said they do not
 * know. That is an answer, not silence, so it does not wait out the grace.
 */
export function serviceHistoryVerdicts(
  input: ServiceHistoryInput,
  now: Date,
): AlertVerdict<'service-baseline-unknown'>[] {
  const { vehicle } = input;

  if (input.confirmedRecords.length === 0 && input.baselines.length === 0) {
    if (isStillBeingSetUp(vehicle, now)) return [];
    if (!isOldEnoughToAsk(vehicle, vehicle.odometer, SERVICE_HISTORY_PROMPT_KM, now)) return [];

    return [
      {
        kind: 'service-baseline-unknown',
        payload: { vehicleId: vehicle.id, odometer: vehicle.odometer, scope: 'vehicle' },
      },
    ];
  }

  return distanceIntervals(input)
    .filter((entry) => entry.lastDone.kind === 'declared-unknown')
    .map((entry) => ({
      kind: 'service-baseline-unknown' as const,
      payload: {
        vehicleId: vehicle.id,
        odometer: vehicle.odometer,
        scope: 'category' as const,
        category: entry.category,
        intervalKm: entry.intervalKm,
      },
    }));
}

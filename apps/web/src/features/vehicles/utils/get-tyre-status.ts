import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  type VehicleServiceIntervalMap,
} from '@vehicle-vault/shared';

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

import type { Vehicle } from '../types/vehicle';

/**
 * `unknown` is not a severity — it means we have no baseline to measure from and
 * therefore no right to a verdict. Rendering it as `healthy` or `overdue` would
 * be an assertion the data does not support.
 */
export type TyreStatus = 'healthy' | 'due' | 'overdue' | 'unknown';

/**
 * Where the "distance travelled" figure is measured from. The UI labels the
 * number differently for each, because they mean genuinely different things.
 */
export type TyreBaselineOrigin =
  /** A logged service of this category. The only origin that supports a verdict about *this* service. */
  | 'record'
  /** Vehicle recorded as bought new (purchaseOdometer === 0), so its whole history is known. */
  | 'new'
  /** Bought used at a known odometer; anything before that is invisible to us. */
  | 'purchase'
  /** No record and no purchase odometer — nothing to measure from. */
  | 'none';

export interface TyreMetric {
  category: MaintenanceCategory;
  status: TyreStatus;
  /** Distance travelled since the baseline, clamped at 0. Null when there is no baseline. */
  kmSince: number | null;
  /** Time elapsed since the baseline. Null when there is no dated baseline. */
  monthsSince: number | null;
  /** Distance still to run before this is due. Negative once overdue. Null when unknown. */
  kmRemaining: number | null;
  /** The interval actually applied — the workshop's own figure when it supplied one. */
  intervalKm: number;
  intervalMonths: number;
  /** True when `intervalKm` came from the record's `nextDueOdometer` rather than the resolved interval. */
  usesRecordNextDue: boolean;
  /** Where the applied interval came from, so the UI can say when it is vehicle-specific. */
  intervalSource: 'workshop' | 'variant' | 'default' | 'fallback';
  origin: TyreBaselineOrigin;
  lastRecord: MaintenanceRecord | null;
}

export interface TyreInsights {
  rotation: TyreMetric;
  alignment: TyreMetric;
  /** Most recent tyre replacement, which resets the wear clock on the tyres themselves. */
  lastReplacement: MaintenanceRecord | null;
  /** Tyre-related history: confirmed records only, newest service date first. */
  records: MaintenanceRecord[];
}

/**
 * Last-resort figures used only when the intervals request has not resolved, so
 * the card can render a number instead of blanking. The authority is
 * `MaintenanceIntervalResolver`, served from `GET /vehicles/:id/intervals`;
 * these must never be treated as the source of truth, because a client that
 * decides its own interval will disagree with the alert engine about the same
 * vehicle.
 */
export const TYRE_FALLBACK_INTERVAL_KM = 10_000;
export const TYRE_FALLBACK_INTERVAL_MONTHS = 12;

/**
 * Matches `MaintenanceForecastService`'s banding so the tab and the server agree
 * at the boundary: at or past the interval is overdue, the last 20% is due.
 */
const DUE_PROGRESS = 0.8;

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

/** Categories surfaced in the tyre history panel, including punctures. */
export const TYRE_CATEGORIES: MaintenanceCategory[] = [
  MaintenanceCategory.TyreRotation,
  MaintenanceCategory.WheelAlignment,
  MaintenanceCategory.TyreReplacement,
  MaintenanceCategory.Puncture,
];

interface GetTyreInsightsArgs {
  vehicle: Vehicle | null;
  records: MaintenanceRecord[];
  /**
   * Resolved from `GET /vehicles/:id/intervals`. Undefined only while that
   * request is in flight; passing nothing falls back to conservative figures
   * rather than blocking the whole panel on a second request.
   */
  intervals?: VehicleServiceIntervalMap;
  now?: Date;
}

export function getTyreInsights({
  vehicle,
  records,
  intervals,
  now = new Date(),
}: GetTyreInsightsArgs): TyreInsights {
  const confirmed = records.filter(isUsableRecord);
  const tyreRecords = [...confirmed]
    .filter((record) => TYRE_CATEGORIES.includes(record.category))
    .sort((left, right) => Date.parse(right.serviceDate) - Date.parse(left.serviceDate));

  return {
    rotation: buildMetric(MaintenanceCategory.TyreRotation, vehicle, confirmed, intervals, now),
    alignment: buildMetric(MaintenanceCategory.WheelAlignment, vehicle, confirmed, intervals, now),
    lastReplacement:
      pickBaselineRecord(confirmed, MaintenanceCategory.TyreReplacement) ?? null,
    records: tyreRecords,
  };
}

/**
 * Drafts are unconfirmed — typically an OCR scan of a bill that nobody has
 * checked yet — so they must not silently reset a service clock.
 */
function isUsableRecord(record: MaintenanceRecord): boolean {
  return record.status !== MaintenanceRecordStatus.Draft;
}

/**
 * Highest odometer wins, not newest service date. The list arrives sorted by
 * date, but a back-dated entry would then win over a later, higher-odometer one
 * and shift the baseline backwards.
 *
 * Records at odometer 0 are skipped: the maintenance form defaults the field to
 * 0, so a 0 here usually means "left blank" rather than a service performed on a
 * vehicle that had never moved.
 */
function pickBaselineRecord(
  records: MaintenanceRecord[],
  category: MaintenanceCategory,
): MaintenanceRecord | undefined {
  return records
    .filter((record) => record.category === category && record.odometer > 0)
    .sort(
      (left, right) =>
        right.odometer - left.odometer ||
        Date.parse(right.serviceDate) - Date.parse(left.serviceDate),
    )
    .at(0);
}

function buildMetric(
  category: MaintenanceCategory,
  vehicle: Vehicle | null,
  records: MaintenanceRecord[],
  intervals: VehicleServiceIntervalMap | undefined,
  now: Date,
): TyreMetric {
  const empty: TyreMetric = {
    category,
    status: 'unknown',
    kmSince: null,
    monthsSince: null,
    kmRemaining: null,
    intervalKm: TYRE_FALLBACK_INTERVAL_KM,
    intervalMonths: TYRE_FALLBACK_INTERVAL_MONTHS,
    usesRecordNextDue: false,
    intervalSource: 'fallback',
    origin: 'none',
    lastRecord: null,
  };

  if (!vehicle) {
    return empty;
  }

  const lastRecord = pickBaselineRecord(records, category) ?? null;
  const baseline = resolveBaseline(vehicle, lastRecord);

  if (baseline.origin === 'none') {
    return { ...empty, lastRecord };
  }

  // Clamped: a service logged above the vehicle's stored reading is a data-entry
  // ordering problem, not negative travel.
  const kmSince = Math.max(0, vehicle.odometer - baseline.odometer);
  const monthsSince = baseline.date
    ? Math.max(0, (now.getTime() - Date.parse(baseline.date)) / MS_PER_MONTH)
    : null;

  const interval = resolveInterval(category, lastRecord, intervals);
  const kmRemaining = interval.km - kmSince;

  return {
    category,
    // A used vehicle with no logged service for this category tells us how far
    // it has run since purchase, but nothing about when it was last serviced.
    status: baseline.origin === 'purchase' ? 'unknown' : gradeStatus(kmSince, monthsSince, interval),
    kmSince,
    monthsSince,
    kmRemaining,
    intervalKm: interval.km,
    intervalMonths: interval.months,
    usesRecordNextDue: interval.fromRecord,
    intervalSource: interval.source,
    origin: baseline.origin,
    lastRecord,
  };
}

interface ResolvedBaseline {
  odometer: number;
  date: string | null;
  origin: TyreBaselineOrigin;
}

function resolveBaseline(
  vehicle: Vehicle,
  lastRecord: MaintenanceRecord | null,
): ResolvedBaseline {
  if (lastRecord) {
    return { odometer: lastRecord.odometer, date: lastRecord.serviceDate, origin: 'record' };
  }

  // Bought new: the odometer *is* the distance since the tyres were fitted, so
  // measuring from zero is a real measurement rather than an assumption.
  if (vehicle.purchaseOdometer === 0) {
    return {
      odometer: 0,
      date: vehicle.purchaseDate ?? vehicle.createdAt,
      origin: 'new',
    };
  }

  if (vehicle.purchaseOdometer != null) {
    return {
      odometer: vehicle.purchaseOdometer,
      date: vehicle.purchaseDate ?? null,
      origin: 'purchase',
    };
  }

  return { odometer: 0, date: null, origin: 'none' };
}

interface ResolvedTyreInterval {
  km: number;
  months: number;
  fromRecord: boolean;
  source: TyreMetric['intervalSource'];
}

/**
 * Precedence: the workshop that serviced this vehicle knows it better than any
 * catalog, which in turn knows it better than a generic default.
 */
function resolveInterval(
  category: MaintenanceCategory,
  lastRecord: MaintenanceRecord | null,
  intervals: VehicleServiceIntervalMap | undefined,
): ResolvedTyreInterval {
  const resolved = intervals?.[category];
  const months = resolved?.months ?? TYRE_FALLBACK_INTERVAL_MONTHS;

  const stated =
    lastRecord?.nextDueOdometer != null ? lastRecord.nextDueOdometer - lastRecord.odometer : null;

  if (stated != null && stated > 0) {
    return { km: stated, months, fromRecord: true, source: 'workshop' };
  }

  if (resolved?.km != null) {
    return { km: resolved.km, months, fromRecord: false, source: resolved.source };
  }

  return {
    km: TYRE_FALLBACK_INTERVAL_KM,
    months,
    fromRecord: false,
    source: resolved ? 'default' : 'fallback',
  };
}

/**
 * Distance and time are both real limits and either can be reached first — a
 * low-mileage vehicle ages out of an interval without ever crossing the
 * odometer threshold.
 */
function gradeStatus(
  kmSince: number,
  monthsSince: number | null,
  interval: ResolvedTyreInterval,
): TyreStatus {
  const progress = Math.max(
    kmSince / interval.km,
    monthsSince != null ? monthsSince / interval.months : 0,
  );

  if (progress >= 1) return 'overdue';
  if (progress >= DUE_PROGRESS) return 'due';
  return 'healthy';
}

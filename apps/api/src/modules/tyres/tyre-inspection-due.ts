import {
  isTwoWheeler,
  TREAD_DEPTH_REPLACE_MM,
  TREAD_DEPTH_WARN_MM,
  TyrePosition,
  type VehicleType,
} from '@vehicle-vault/shared';

/**
 * Tread on a new tyre, taken as the depth at fitting when nobody has measured
 * it. A car tyre leaves the factory at about 8 mm; a motorcycle tyre is
 * shallower, about 6 mm.
 */
const NEW_TREAD_MM = { car: 8, twoWheeler: 6 } as const;

/**
 * Typical wear until a tyre's own readings say otherwise: a car tyre lasts
 * about 45,000 km from new to the legal limit (roughly 1 mm per 7,000 km); a
 * motorcycle's, its rear especially, about half that.
 */
const DEFAULT_KM_PER_MM = { car: 7_000, twoWheeler: 5_000 } as const;

/**
 * However slowly a tyre is wearing, someone should look at it once a year: for
 * cuts, bulges and pressure, which no projection can see.
 */
export const TYRE_LOOK_INTERVAL_MONTHS = 12;

/**
 * The depths at which a reading is worth having, deepest first: a millimetre
 * before the warning, the warning itself, and the replacement point. A tyre is
 * asked about when its projected tread reaches the first of these below its
 * last known depth, so each reading moves the next request on rather than
 * repeating it.
 */
const CHECKPOINTS_MM = [TREAD_DEPTH_WARN_MM + 1, TREAD_DEPTH_WARN_MM, TREAD_DEPTH_REPLACE_MM];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface InspectionDueTyre {
  position: TyrePosition;
  fittedDate: Date;
  fittedOdometer: number;
  expectedLifeKm: number | null;
  /** Newest first. */
  inspections: { inspectedAt: Date; odometer: number; treadDepthMm: number | null }[];
}

/** Why a vehicle's tyres want a reading now, measured from the tyre that wants it most. */
export interface TyreInspectionDue {
  /** `wear`: the projection reached a checkpoint. `time`: a year since anyone looked. */
  trigger: 'wear' | 'time';
  /** False when the tyre has never had its tread measured, and the look is its fitting. */
  measured: boolean;
  kmSinceLastCheck: number;
  daysSinceLastCheck: number;
  /** Tread the projection puts the tyre at today, rounded to 0.5 mm. */
  projectedTreadMm: number;
}

interface TyreNeed {
  due: boolean;
  inspection: TyreInspectionDue;
}

/**
 * Whether the vehicle's tyres need a reading, judged per road tyre from what is
 * known about it rather than a fixed distance: the last measured depth (or a
 * new tyre's depth at fitting), worn on at the tyre's own measured rate, else
 * the rate its expected life implies, else a typical rate for the vehicle type.
 * A new car's original tyres are therefore left alone for a year or about
 * 20,000 km, while a set already near the warning depth is asked about soon.
 *
 * The spare covers none of the vehicle's mileage and is left out. Null when no
 * road tyre wants a reading.
 */
export function tyreInspectionDue(
  tyres: InspectionDueTyre[],
  vehicleOdometer: number,
  vehicleType: VehicleType,
  now: Date,
): TyreInspectionDue | null {
  const kind = isTwoWheeler(vehicleType) ? 'twoWheeler' : 'car';
  const lookCutoff = new Date(now);
  lookCutoff.setMonth(lookCutoff.getMonth() - TYRE_LOOK_INTERVAL_MONTHS);

  const due = tyres
    .filter((tyre) => tyre.position !== TyrePosition.Spare)
    .map((tyre) => need(tyre, vehicleOdometer, kind, lookCutoff, now))
    .filter((tyreNeed) => tyreNeed.due)
    // The most worn corner speaks for the vehicle; on a tie, the longest unseen.
    .map((tyreNeed) => tyreNeed.inspection)
    .sort(
      (a, b) =>
        a.projectedTreadMm - b.projectedTreadMm || b.daysSinceLastCheck - a.daysSinceLastCheck,
    );

  return due.at(0) ?? null;
}

function need(
  tyre: InspectionDueTyre,
  vehicleOdometer: number,
  kind: 'car' | 'twoWheeler',
  lookCutoff: Date,
  now: Date,
): TyreNeed {
  const measured = tyre.inspections.filter(
    (inspection): inspection is typeof inspection & { treadDepthMm: number } =>
      inspection.treadDepthMm != null,
  );
  const newest = measured.at(0);
  const newTreadMm = NEW_TREAD_MM[kind];
  const baseline = newest
    ? { mm: newest.treadDepthMm, odometer: newest.odometer }
    : { mm: newTreadMm, odometer: tyre.fittedOdometer };

  const kmPerMm = observedKmPerMm(measured) ?? expectedKmPerMm(tyre, newTreadMm);
  const kmSinceBaseline = Math.max(0, vehicleOdometer - baseline.odometer);
  const projected = baseline.mm - kmSinceBaseline / (kmPerMm ?? DEFAULT_KM_PER_MM[kind]);

  const checkpoint = CHECKPOINTS_MM.find((mm) => mm < baseline.mm);
  const wearDue = checkpoint != null && projected <= checkpoint;

  // Any look counts for the yearly walk-around, a pressure-only one included.
  const lastLook = tyre.inspections.at(0);
  const lookAt = lastLook?.inspectedAt ?? tyre.fittedDate;
  const lookOdometer = lastLook?.odometer ?? tyre.fittedOdometer;
  const timeDue = lookAt <= lookCutoff;

  return {
    due: wearDue || timeDue,
    inspection: {
      trigger: wearDue ? 'wear' : 'time',
      measured: newest != null,
      kmSinceLastCheck: Math.max(0, vehicleOdometer - lookOdometer),
      daysSinceLastCheck: Math.max(0, Math.floor((now.getTime() - lookAt.getTime()) / MS_PER_DAY)),
      projectedTreadMm: Math.max(0, Math.round(projected * 2) / 2),
    },
  };
}

/** Distance per millimetre between the oldest and newest readings, when both moved. */
function observedKmPerMm(measured: { odometer: number; treadDepthMm: number }[]): number | null {
  const newest = measured.at(0);
  const oldest = measured.at(-1);
  if (!newest || !oldest || newest === oldest) return null;

  const km = newest.odometer - oldest.odometer;
  const mm = oldest.treadDepthMm - newest.treadDepthMm;
  return km > 0 && mm > 0 ? km / mm : null;
}

/** The rate an owner-entered expected life implies, from new tread to the replacement depth. */
function expectedKmPerMm(tyre: InspectionDueTyre, newTreadMm: number): number | null {
  if (tyre.expectedLifeKm == null || tyre.expectedLifeKm <= 0) return null;
  return tyre.expectedLifeKm / (newTreadMm - TREAD_DEPTH_REPLACE_MM);
}

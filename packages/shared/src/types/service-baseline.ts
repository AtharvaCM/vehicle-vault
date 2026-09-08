import type { z } from 'zod';

import type {
  ServiceBaselineEntrySchema,
  ServiceBaselineSchema,
  ServiceBaselineUpsertSchema,
} from '../schemas';
import type { MaintenanceCategory } from '../enums/maintenance-category.enum';

export type ServiceBaselineEntryInput = z.infer<typeof ServiceBaselineEntrySchema>;
export type ServiceBaselineUpsertInput = z.infer<typeof ServiceBaselineUpsertSchema>;
export type ServiceBaseline = z.infer<typeof ServiceBaselineSchema>;

/**
 * Where the alert engine's "last done" figure for a category comes from, worst
 * knowledge last.
 *
 * `unset` is the state every vehicle starts in and the one the engine treats
 * with its historical fallback — measuring from the odometer at the moment the
 * vehicle was added. That fallback is a guess, and naming it here is what lets
 * the UI say so instead of presenting it as fact.
 */
export type ServiceBaselineSource = 'record' | 'baseline' | 'declared-unknown' | 'unset';

export interface VehicleServiceBaselineEntry {
  category: MaintenanceCategory;
  source: ServiceBaselineSource;
  /** The odometer the interval is measured from; null when there is nothing to measure from. */
  lastDoneOdometer: number | null;
  lastDoneDate: string | null;
  /** The stored row, when one exists. Null for `record` and `unset`. */
  baseline: ServiceBaseline | null;
}

/**
 * One entry per category that actually applies to this vehicle, resolved
 * through `MaintenanceIntervalResolver` so an EV is never asked when its engine
 * oil was last changed.
 */
export interface VehicleServiceBaselineCoverage {
  vehicleId: string;
  entries: VehicleServiceBaselineEntry[];
  /** Categories with neither a logged service nor a baseline — what is left to answer. */
  unansweredCount: number;
}

/**
 * Distance covered with no service history on file at all before the app says
 * so. Below it a vehicle is plausibly new enough that nothing has been due yet,
 * and the silence is honest.
 */
export const SERVICE_HISTORY_PROMPT_KM = 10000;

/**
 * Age at which a vehicle's history is worth asking about regardless of
 * distance. Wear items age on the calendar — oil oxidises, rubber hardens,
 * coolant loses inhibitors — so a garage-kept vehicle with almost no mileage
 * still has a history worth knowing.
 */
export const VEHICLE_AGE_PROMPT_YEARS = 5;

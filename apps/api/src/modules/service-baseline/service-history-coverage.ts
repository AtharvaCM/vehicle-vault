import type { MaintenanceCategory, VehicleServiceIntervalMap } from '@vehicle-vault/shared';

/**
 * The categories that apply to a vehicle with neither a confirmed service
 * record nor a baseline answer: what is left to ask about its history. An
 * answer of "unknown" is still an answer, and a draft record is not evidence.
 *
 * The service-history card counts these as `unset`, and the dashboard's data
 * score counts them as the gap in service history, so both read them here.
 */
export function unansweredCategories(
  intervals: VehicleServiceIntervalMap,
  confirmedRecords: readonly { category: string }[],
  baselines: readonly { category: string }[],
): MaintenanceCategory[] {
  const answered = new Set<string>([
    ...confirmedRecords.map((record) => record.category),
    ...baselines.map((baseline) => baseline.category),
  ]);

  return (Object.keys(intervals) as MaintenanceCategory[]).filter(
    (category) => !answered.has(category),
  );
}

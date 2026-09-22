import type { MaintenanceRecord } from '../types/maintenance-record';
import { isDraftRecord } from './is-draft-record';

export type MaintenanceHistorySummary = {
  recordCount: number;
  draftCount: number;
  vehiclesWithHistory: number;
  totalSpend: number;
  latestServiceDate: string | null;
};

/**
 * The garage-wide figures above the maintenance list. They count confirmed
 * records only, the rows the API's analytics and reports count, so the spend
 * here cannot run ahead of the spend there; drafts are reported on their own so
 * they can be found and confirmed.
 */
export function summarizeMaintenanceHistory(
  records: MaintenanceRecord[],
): MaintenanceHistorySummary {
  const confirmed = records.filter((record) => !isDraftRecord(record));
  const latestServiceDate = confirmed.reduce<string | null>(
    (latest, record) =>
      latest === null || Date.parse(record.serviceDate) > Date.parse(latest)
        ? record.serviceDate
        : latest,
    null,
  );

  return {
    recordCount: confirmed.length,
    draftCount: records.length - confirmed.length,
    vehiclesWithHistory: new Set(confirmed.map((record) => record.vehicleId)).size,
    totalSpend: confirmed.reduce((sum, record) => sum + record.totalCost, 0),
    latestServiceDate,
  };
}

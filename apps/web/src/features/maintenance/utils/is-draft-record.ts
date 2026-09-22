import { MaintenanceRecordStatus } from '@vehicle-vault/shared';

/**
 * A draft counts in no cost, report, forecast or reminder until someone confirms
 * it, so anywhere a record is listed it says so rather than passing as a logged
 * service. `status` is optional on the wire, and a record without one is a
 * confirmed record.
 */
export function isDraftRecord(record: { status?: MaintenanceRecordStatus }) {
  return record.status === MaintenanceRecordStatus.Draft;
}

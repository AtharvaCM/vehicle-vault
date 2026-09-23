import { toDateInputValue } from '@/lib/utils/to-date-input-value';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { isDraftRecord } from './is-draft-record';

/**
 * The confirmed service logged last on or before `serviceDate` (a date input's
 * `yyyy-MM-dd`), which a new reading should not be lower than. Bounded by the
 * date so back-filling an older service is not compared with a newer one.
 * Drafts count for nothing until confirmed, so they are skipped here too.
 */
export function findPreviousConfirmedService(
  records: Pick<MaintenanceRecord, 'id' | 'serviceDate' | 'odometer' | 'status'>[],
  { serviceDate, excludeRecordId }: { serviceDate: string; excludeRecordId?: string },
) {
  let previous: (typeof records)[number] | null = null;

  for (const record of records) {
    const recordDate = toDateInputValue(record.serviceDate);

    if (record.id === excludeRecordId || isDraftRecord(record) || recordDate > serviceDate) {
      continue;
    }

    const previousDate = previous ? toDateInputValue(previous.serviceDate) : '';

    if (
      !previous ||
      recordDate > previousDate ||
      (recordDate === previousDate && record.odometer > previous.odometer)
    ) {
      previous = record;
    }
  }

  return previous;
}

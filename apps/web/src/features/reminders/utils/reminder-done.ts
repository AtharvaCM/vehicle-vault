import type { MaintenanceCategory, Reminder } from '@vehicle-vault/shared';

import type { LogServiceSearch } from '@/features/maintenance/types/log-service-search';

/** The fields of a reminder (or a Home / Upcoming reminder row) that decide what its Done does. */
export type DoneSubject = {
  id: string;
  vehicleId: string;
  logCategory?: MaintenanceCategory;
  renewsDocument?: Reminder['renewsDocument'];
};

/**
 * What Done does, decided the same way on every surface:
 * - `renew`: the reminder follows a paper, so Done is the paper's Renew;
 *   renewing it closes the reminder and starts the next (the API's Renewal).
 * - `log`: work on the vehicle; Done asks whether to log the service now
 *   (the record completes the reminder) or mark it done without logging.
 * - `complete`: anything else is simply marked done.
 */
export type DoneAction = 'renew' | 'log' | 'complete';

export function reminderDoneAction(subject: DoneSubject): DoneAction {
  if (subject.renewsDocument) return 'renew';
  if (subject.logCategory) return 'log';
  return 'complete';
}

/** The new-record route's search for "Log the service now". */
export function logServiceSearchFor(subject: DoneSubject): LogServiceSearch {
  return {
    ...(subject.logCategory ? { category: subject.logCategory } : {}),
    reminderId: subject.id,
  };
}

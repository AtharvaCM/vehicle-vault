import { ReminderType, type Reminder } from '@vehicle-vault/shared';

import { describeRepeatRule } from './repeat-rule';

/** Renewals completed early keep their cycle (the API's `nextOccurrenceDue`). */
const CYCLE_KEEPING_TYPES: ReadonlySet<ReminderType> = new Set([
  ReminderType.Insurance,
  ReminderType.Puc,
  ReminderType.Tax,
]);

const TYRE_INSPECTION_SLUG = 'tyre_inspection';

type WhatDoneDoesSubject = Pick<
  Reminder,
  'type' | 'catalogSlug' | 'repeatEveryMonths' | 'repeatEveryKm' | 'logCategory' | 'renewsDocument'
>;

/**
 * The reminder page's "what happens next": its repeat rule, and what
 * completing it counts the next one from, in the words the API's rule would
 * use. "Repeats every 10,000 km or 12 months; the next one will be counted
 * from the service you log." Null for a renewal that follows a paper, whose
 * page already says renewing the paper closes it and starts the next.
 */
export function describeWhatDoneDoes(reminder: WhatDoneDoesSubject): string | null {
  if (reminder.renewsDocument) return null;

  const repeats = reminder.repeatEveryMonths != null || reminder.repeatEveryKm != null;
  if (!repeats) {
    return reminder.logCategory
      ? 'Doesn’t repeat: logging the service closes it.'
      : 'Doesn’t repeat: marking it done closes it.';
  }

  const rule = describeRepeatRule(reminder).replace(/, whichever comes first$/, '');
  if (reminder.logCategory) {
    return `${rule}; the next one will be counted from the service you log.`;
  }
  if (reminder.catalogSlug === TYRE_INSPECTION_SLUG) {
    return `${rule}; the next one is counted from your last tyre reading.`;
  }
  if (CYCLE_KEEPING_TYPES.has(reminder.type)) {
    return `${rule}; the next one keeps its cycle, counted from this due date (or from the day you mark it done, if that is later).`;
  }
  return `${rule}; the next one is counted from the day you mark it done.`;
}

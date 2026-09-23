import { ReminderType } from '@vehicle-vault/shared';

/**
 * A **repeat rule**: every so many months and/or kilometres, whichever comes
 * first when both are set. Stored on `Reminder` as `repeatEveryMonths` and
 * `repeatEveryKm`; both null means it does not repeat.
 *
 * Nothing here is reminder-specific beyond the renewal types below, so a
 * document expiry can follow the same rule when reminders and documents merge
 * into one list of upcoming things.
 */
export type RepeatRule = {
  everyMonths: number | null;
  everyKm: number | null;
};

/** Where an interval is counted from: a moment and the odometer at it. */
export type RepeatAnchor = {
  odometer: number;
  at: Date;
};

export type NextDue = {
  dueDate: Date | null;
  dueOdometer: number | null;
};

/**
 * Renewals run on a fixed cycle: renewing a policy a week early does not move
 * next year's expiry a week earlier. Everything else (a service, a check) is
 * counted from when it was done.
 */
const RENEWAL_TYPES: ReadonlySet<ReminderType> = new Set([
  ReminderType.Insurance,
  ReminderType.Puc,
  ReminderType.Tax,
]);

export function hasRepeatRule(rule: RepeatRule): boolean {
  return rule.everyMonths != null || rule.everyKm != null;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * When the occurrence after a completed one is due, or null when there is
 * nothing to schedule.
 *
 * The date counts from the anchor (usually the moment it was completed) and,
 * for a renewal completed early, from the completed reminder's due date
 * instead. Kilometres count from the anchor's odometer.
 *
 * A successor that would be born already due on every dimension it has is not
 * scheduled: it would repeat what the completed reminder said, and completing
 * that one would produce another.
 */
export function nextOccurrenceDue(input: {
  rule: RepeatRule;
  type: ReminderType;
  previousDueDate: Date | null;
  anchor: RepeatAnchor;
  now: Date;
  currentOdometer: number;
}): NextDue | null {
  const { rule, type, previousDueDate, anchor, now, currentOdometer } = input;

  if (!hasRepeatRule(rule)) {
    return null;
  }

  const dateBase =
    RENEWAL_TYPES.has(type) && previousDueDate && previousDueDate.getTime() > anchor.at.getTime()
      ? previousDueDate
      : anchor.at;
  const dueDate = rule.everyMonths != null ? addMonths(dateBase, rule.everyMonths) : null;
  const dueOdometer = rule.everyKm != null ? anchor.odometer + rule.everyKm : null;

  const odometerReached = dueOdometer == null || dueOdometer <= currentOdometer;
  const dateReached = dueDate == null || dueDate.getTime() <= now.getTime();

  if (odometerReached && dateReached) {
    return null;
  }

  return { dueDate, dueOdometer };
}

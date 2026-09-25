import { z } from 'zod';

/**
 * **Snooze** is a reminder's "not now": it moves the reminder on by a week, a
 * month, or to a day the owner picks. The API applies it and the web previews
 * it with the same function, so the preview cannot promise a date the API
 * will not write.
 */
export const REMINDER_SNOOZE_PERIODS = ['week', 'month'] as const;
export type ReminderSnoozePeriod = (typeof REMINDER_SNOOZE_PERIODS)[number];

/** Kilometres move at this rate for every started week a reminder is snoozed. */
export const REMINDER_SNOOZE_KM_PER_WEEK = 500;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A week (the default when nothing is sent), a month, or `until` a calendar day (`YYYY-MM-DD`). */
export const ReminderSnoozeSchema = z
  .object({
    period: z.enum(REMINDER_SNOOZE_PERIODS).optional(),
    until: z.string().regex(DAY_PATTERN, 'Use a YYYY-MM-DD day').optional(),
  })
  .refine((value) => !(value.period && value.until), {
    message: 'Snooze by a period or until a day, not both',
    path: ['until'],
  });

export type ReminderSnoozeInput = z.infer<typeof ReminderSnoozeSchema>;

type SnoozeSubject = {
  dueDate?: Date | string | null;
  dueOdometer?: number | null;
};

export type ReminderSnoozeTarget = { dueDate: Date | null; dueOdometer: number | null };

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(value);
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** A calendar month on, clamped to the month's last day (31 Jan → 28 or 29 Feb). */
function addOneMonth(from: Date): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const result = new Date(from.getTime());
  result.setUTCFullYear(year, month, Math.min(from.getUTCDate(), lastDay));
  return result;
}

/**
 * What a snooze counts from: the reminder's own date when that is still
 * ahead, otherwise today. A late reminder snoozed a week is due a week from
 * today, not a week after the day it was missed.
 */
export function reminderSnoozeBase(subject: SnoozeSubject, now: Date): Date {
  const today = utcDay(now);
  const dueDate = toDate(subject.dueDate);
  return new Date(dueDate ? Math.max(dueDate.getTime(), today) : today);
}

/** The first day a snooze "until" may pick: the day after its base. */
export function reminderSnoozeEarliestDay(subject: SnoozeSubject, now: Date): Date {
  return new Date(utcDay(reminderSnoozeBase(subject, now)) + MS_PER_DAY);
}

/**
 * Where a snooze moves a reminder. A dated reminder gets its new date: a week
 * or a calendar month on from its base, or the picked day. Where it counts
 * kilometres, the target moves on from the odometer or the target, whichever
 * is further, by {@link REMINDER_SNOOZE_KM_PER_WEEK} per started week of the
 * same span, so a week is 500 km and a month about 2,000. Null when the picked
 * day is not after the base (a snooze never brings a reminder closer).
 */
export function reminderSnoozeTarget(
  subject: SnoozeSubject,
  currentOdometer: number,
  choice: ReminderSnoozeInput,
  now: Date,
): ReminderSnoozeTarget | null {
  const base = reminderSnoozeBase(subject, now);
  let until: Date;

  if (choice.until) {
    until = new Date(`${choice.until}T00:00:00.000Z`);
    if (Number.isNaN(until.getTime()) || utcDay(until) <= utcDay(base)) return null;
  } else if (choice.period === 'month') {
    until = addOneMonth(base);
  } else {
    until = new Date(base.getTime() + 7 * MS_PER_DAY);
  }

  const days = Math.max(1, Math.round((utcDay(until) - utcDay(base)) / MS_PER_DAY));
  const dueOdometer =
    subject.dueOdometer === null || subject.dueOdometer === undefined
      ? null
      : Math.max(subject.dueOdometer, currentOdometer) +
        Math.ceil(days / 7) * REMINDER_SNOOZE_KM_PER_WEEK;

  return {
    dueDate: toDate(subject.dueDate) ? until : null,
    dueOdometer,
  };
}

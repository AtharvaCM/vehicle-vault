import { ReminderStatus, type MaintenanceCategory, type Reminder } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

import { reminderWork } from './service-work';

/** A category the form starts on, and the one line saying why. */
export type CategoryPick = {
  category: MaintenanceCategory;
  reason: string;
};

/** "This week", as Home and Upcoming group it. */
const SOON_DAYS = 7;

type DueReminder = Pick<
  Reminder,
  'type' | 'title' | 'catalogSlug' | 'status' | 'dueDate' | 'dueOdometer'
>;

type Due = { words: string; rank: number };

function dayCount(days: number) {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/**
 * When a reminder is due, in words that finish "the oil change …", and how
 * urgent that is (lower first). Null when it is not due this week.
 */
function dueNow(reminder: DueReminder, now: Date): Due | null {
  const days = reminder.dueDate ? format.daysUntil(reminder.dueDate, now) : null;

  if (reminder.status === ReminderStatus.Completed) return null;

  if (reminder.status === ReminderStatus.Overdue) {
    if (days !== null && days < 0) return { words: `is ${dayCount(-days)} late`, rank: days };
    // Late by distance while the date is still ahead.
    if (reminder.dueOdometer !== undefined) {
      return { words: `was due at ${format.odometer(reminder.dueOdometer)}`, rank: 0 };
    }
    return { words: 'is late', rank: 0 };
  }

  if (reminder.status === ReminderStatus.DueToday || days === 0) {
    return { words: 'is due today', rank: 1 };
  }

  if (days !== null && days > 0 && days <= SOON_DAYS) {
    return {
      words: days === 1 ? 'is due tomorrow' : `is due in ${dayCount(days)}`,
      rank: 1 + days,
    };
  }

  return null;
}

/**
 * The service a vehicle's reminders say is due, most urgent first: late, then
 * today, then this week. Only a reminder that stands for work done at a
 * workshop counts (see `reminderWork`); a renewal does not.
 */
export function pickDueCategory(
  reminders: readonly DueReminder[],
  now: Date = new Date(),
): CategoryPick | null {
  let best: (CategoryPick & { rank: number }) | null = null;

  for (const reminder of reminders) {
    const work = reminderWork(reminder);
    const due = work ? dueNow(reminder, now) : null;

    if (!work || !due || (best && best.rank <= due.rank)) continue;

    best = {
      category: work.category,
      reason: `Picked because ${work.phrase} ${due.words}.`,
      rank: due.rank,
    };
  }

  return best ? { category: best.category, reason: best.reason } : null;
}

/**
 * The category for a service logged from a reminder (`?reminderId=`), naming
 * the reminder. A `category` from the address wins over the reminder's own.
 */
export function pickFromReminder(
  reminder: Pick<Reminder, 'type' | 'title' | 'catalogSlug'>,
  category: MaintenanceCategory | undefined,
): CategoryPick | null {
  const chosen = category ?? reminderWork(reminder)?.category;

  return chosen
    ? { category: chosen, reason: `For your reminder “${reminder.title.trim()}”.` }
    : null;
}

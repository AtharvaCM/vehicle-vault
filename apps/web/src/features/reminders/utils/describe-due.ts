import type { Status } from '@/components/shared/status-pill';
import { format } from '@/lib/format';

import type { Reminder } from '../types/reminder';

export type DueWords = { status: Status; text: string };

/** "early Oct", "mid-Oct", "late Oct": a projected date, as roughly as it deserves. */
function roughly(date: Date) {
  const [month] = format.date(date, 'monthYear').split(' ');
  const day = Number(format.date(date, 'dayMonth').split(' ')[0]);
  return day <= 10 ? `early ${month}` : day <= 20 ? `mid-${month}` : `late ${month}`;
}

/**
 * Where a reminder stands, in words for its page: by date ("Overdue by 3
 * days — was due 20 Sep 2026", "Due today", "Due in 12 days — 7 Oct 2026"),
 * or by distance when it has no date ("Due at 27,500 km — 1,200 km to go
 * (≈ mid-Oct at your usage)", the estimate from the API's usage projection).
 * A completed one says when it was done.
 */
export function describeDue(
  reminder: Pick<
    Reminder,
    'status' | 'completedAt' | 'dueDate' | 'dueOdometer' | 'usageProjection'
  >,
  { odometer, now = new Date() }: { odometer?: number; now?: Date } = {},
): DueWords {
  if (reminder.completedAt) {
    return { status: 'ended', text: `Done on ${format.date(reminder.completedAt)}` };
  }

  if (reminder.dueDate) {
    // Indian calendar days, as every other due count in the app.
    const days = format.daysUntil(reminder.dueDate, now) ?? 0;
    const on = format.date(reminder.dueDate);
    if (days < 0) {
      const late = -days;
      return {
        status: 'late',
        text: `Overdue by ${late} day${late === 1 ? '' : 's'} — was due ${on}`,
      };
    }
    if (days === 0) return { status: 'soon', text: 'Due today' };
    return {
      status: days <= 7 ? 'soon' : 'info',
      text: `Due in ${days} day${days === 1 ? '' : 's'} — ${on}`,
    };
  }

  if (reminder.dueOdometer !== undefined) {
    const at = `Due at ${format.odometer(reminder.dueOdometer)}`;
    if (odometer === undefined) return { status: 'info', text: at };

    const left = reminder.dueOdometer - odometer;
    if (left <= 0) {
      return { status: 'late', text: `${at} — ${format.distance(-left)} past it` };
    }
    const projected = reminder.usageProjection?.projectedDueDate;
    const estimate = projected ? ` (≈ ${roughly(new Date(projected))} at your usage)` : '';
    return {
      status: left <= 500 ? 'soon' : 'info',
      text: `${at} — ${format.distance(left)} to go${estimate}`,
    };
  }

  return { status: 'info', text: 'No due date' };
}

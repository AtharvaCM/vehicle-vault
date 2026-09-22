import { ReminderStatus } from '@vehicle-vault/shared';

/** How urgent each status is; a reminder takes the most urgent of its date and odometer. */
export const reminderStatusPriority: Record<ReminderStatus, number> = {
  [ReminderStatus.Upcoming]: 0,
  [ReminderStatus.DueToday]: 1,
  [ReminderStatus.Overdue]: 2,
  [ReminderStatus.Completed]: 3,
};

function toUtcDayTimestamp(value: string) {
  const date = new Date(value);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dueDateStatus(dueDate: string, now: Date) {
  const dueDay = toUtcDayTimestamp(dueDate);
  const today = toUtcDayTimestamp(now.toISOString());

  if (dueDay < today) {
    return ReminderStatus.Overdue;
  }

  if (dueDay === today) {
    return ReminderStatus.DueToday;
  }

  return ReminderStatus.Upcoming;
}

function dueOdometerStatus(dueOdometer: number, currentOdometer: number) {
  if (dueOdometer < currentOdometer) {
    return ReminderStatus.Overdue;
  }

  if (dueOdometer === currentOdometer) {
    return ReminderStatus.DueToday;
  }

  return ReminderStatus.Upcoming;
}

/**
 * A reminder's status from its due date and odometer: the more urgent of the
 * two, or completed once it has been. Shared by the reminders service and the
 * reminder a confirmed service record produces, so both store the same thing.
 */
export function computeReminderStatus(
  reminder: {
    dueDate?: string;
    dueOdometer?: number;
    completedAt?: string;
  },
  currentOdometer?: number,
  now: Date = new Date(),
): ReminderStatus {
  if (reminder.completedAt) {
    return ReminderStatus.Completed;
  }

  const byDate = reminder.dueDate ? dueDateStatus(reminder.dueDate, now) : null;
  const byOdometer =
    reminder.dueOdometer !== undefined && currentOdometer !== undefined
      ? dueOdometerStatus(reminder.dueOdometer, currentOdometer)
      : null;

  return [byDate, byOdometer].reduce<ReminderStatus>((current, candidate) => {
    if (!candidate) {
      return current;
    }

    return reminderStatusPriority[candidate] > reminderStatusPriority[current]
      ? candidate
      : current;
  }, ReminderStatus.Upcoming);
}

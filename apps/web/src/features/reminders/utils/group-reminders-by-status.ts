import { ReminderStatus } from '@vehicle-vault/shared';

import type { Reminder } from '../types/reminder';

export function groupRemindersByStatus(reminders: Reminder[]) {
  return {
    [ReminderStatus.Overdue]: reminders.filter((item) => item.status === ReminderStatus.Overdue),
    [ReminderStatus.DueToday]: reminders.filter((item) => item.status === ReminderStatus.DueToday),
    [ReminderStatus.Upcoming]: reminders.filter((item) => item.status === ReminderStatus.Upcoming),
    [ReminderStatus.Completed]: reminders.filter(
      (item) => item.status === ReminderStatus.Completed,
    ),
  };
}

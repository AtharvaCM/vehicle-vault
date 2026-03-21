import { ReminderStatus, type ReminderType } from '@vehicle-vault/shared';

import type { ReminderSortOption } from '../components/reminder-list-controls';
import type { Reminder } from '../types/reminder';
import { formatReminderStatus } from './format-reminder-status';
import { formatReminderType } from './format-reminder-type';

type FilterAndSortRemindersArgs = {
  reminders: Reminder[];
  searchValue: string;
  status: ReminderStatus | 'all';
  type: ReminderType | 'all';
  sortBy: ReminderSortOption;
  vehicleLabelById?: Record<string, string>;
};

const urgencyRank: Record<ReminderStatus, number> = {
  [ReminderStatus.Overdue]: 0,
  [ReminderStatus.DueToday]: 1,
  [ReminderStatus.Upcoming]: 2,
  [ReminderStatus.Completed]: 3,
};

function getDueDateValue(reminder: Reminder) {
  return reminder.dueDate ? Date.parse(reminder.dueDate) : null;
}

function compareOptionalDates(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc',
) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === 'asc' ? left - right : right - left;
}

export function filterAndSortReminders({
  reminders,
  searchValue,
  status,
  type,
  sortBy,
  vehicleLabelById = {},
}: FilterAndSortRemindersArgs) {
  const normalizedSearch = searchValue.trim().toLowerCase();

  return reminders
    .filter((reminder) => {
      if (status !== 'all' && reminder.status !== status) {
        return false;
      }

      if (type !== 'all' && reminder.type !== type) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchFields = [
        reminder.title,
        reminder.notes ?? '',
        reminder.dueDate ?? '',
        reminder.dueOdometer?.toString() ?? '',
        vehicleLabelById[reminder.vehicleId] ?? '',
        formatReminderType(reminder.type),
        formatReminderStatus(reminder.status),
      ];

      return searchFields.some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) => {
      switch (sortBy) {
        case 'due-date-asc':
          return compareOptionalDates(getDueDateValue(left), getDueDateValue(right), 'asc');
        case 'due-date-desc':
          return compareOptionalDates(getDueDateValue(left), getDueDateValue(right), 'desc');
        case 'updated-desc':
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        case 'urgency':
        default: {
          const rankDifference = urgencyRank[left.status] - urgencyRank[right.status];

          if (rankDifference !== 0) {
            return rankDifference;
          }

          const dueDateDifference = compareOptionalDates(
            getDueDateValue(left),
            getDueDateValue(right),
            'asc',
          );

          if (dueDateDifference !== 0) {
            return dueDateDifference;
          }

          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        }
      }
    });
}

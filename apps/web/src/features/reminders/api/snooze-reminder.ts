import type { ReminderSnoozeInput } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Reminder } from '../types/reminder';

export type SnoozeReminderVariables = {
  reminderId: string;
  /** A week, a month, or until a day; kilometres move 500 km for each week of the same span. */
  choice: ReminderSnoozeInput;
};

export async function snoozeReminder({ reminderId, choice }: SnoozeReminderVariables) {
  const response = await apiClient.patch<ApiSuccessResponse<Reminder>, ReminderSnoozeInput>(
    endpoints.reminders.snooze(reminderId),
    choice,
  );

  return response.data;
}

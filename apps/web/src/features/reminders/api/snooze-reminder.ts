import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Reminder } from '../types/reminder';

/** Moves the reminder a week (and, where it counts kilometres, 500 km) on. */
export async function snoozeReminder(reminderId: string) {
  const response = await apiClient.patch<ApiSuccessResponse<Reminder>, undefined>(
    endpoints.reminders.snooze(reminderId),
  );

  return response.data;
}

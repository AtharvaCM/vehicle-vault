import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Reminder, UpdateReminderInput } from '../types/reminder';

export async function updateReminder(reminderId: string, input: UpdateReminderInput) {
  const response = await apiClient.patch<ApiSuccessResponse<Reminder>, UpdateReminderInput>(
    endpoints.reminders.update(reminderId),
    input,
  );

  return response.data;
}

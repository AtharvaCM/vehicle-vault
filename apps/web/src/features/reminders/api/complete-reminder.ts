import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Reminder } from '../types/reminder';

export async function completeReminder(reminderId: string) {
  const response = await apiClient.patch<ApiSuccessResponse<Reminder>, undefined>(
    endpoints.reminders.complete(reminderId),
  );

  return response.data;
}

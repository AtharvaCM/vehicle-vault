import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { CreateReminderBody, Reminder } from '../types/reminder';

export async function createReminder(vehicleId: string, input: CreateReminderBody) {
  const response = await apiClient.post<ApiSuccessResponse<Reminder>, CreateReminderBody>(
    endpoints.reminders.create(vehicleId),
    input,
  );

  return response.data;
}

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type DeleteReminderResponse = {
  id: string;
  deleted: true;
};

export async function deleteReminder(reminderId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<DeleteReminderResponse>>(
    endpoints.reminders.delete(reminderId),
  );

  return response.data;
}

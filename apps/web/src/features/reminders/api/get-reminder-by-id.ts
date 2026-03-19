import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { Reminder } from '../types/reminder';

export async function getReminderById(reminderId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Reminder>>(
    endpoints.reminders.detail(reminderId),
  );

  return response.data;
}

export function reminderDetailQueryOptions(reminderId: string) {
  return queryOptions({
    queryKey: queryKeys.reminders.detail(reminderId),
    queryFn: () => getReminderById(reminderId),
  });
}

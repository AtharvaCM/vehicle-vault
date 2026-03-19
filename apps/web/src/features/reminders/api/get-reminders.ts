import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { ReminderSummary } from '../types/reminder';

export async function getReminders() {
  return apiClient.get<ReminderSummary[]>(endpoints.reminders.list);
}

export function remindersQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.reminders.list(),
    queryFn: getReminders,
  });
}

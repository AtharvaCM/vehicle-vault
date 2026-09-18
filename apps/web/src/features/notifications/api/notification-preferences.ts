import { queryOptions } from '@tanstack/react-query';
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '@vehicle-vault/shared';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiClient.get<ApiSuccessResponse<NotificationPreferences>>(
    endpoints.notifications.preferences(),
  );
  return response.data;
}

export function notificationPreferencesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: getNotificationPreferences,
  });
}

/** Sends only the kinds to change; the response is every kind as saved. */
export async function updateNotificationPreferences(
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferences> {
  const response = await apiClient.put<
    ApiSuccessResponse<NotificationPreferences>,
    UpdateNotificationPreferencesInput
  >(endpoints.notifications.preferences(), input);
  return response.data;
}

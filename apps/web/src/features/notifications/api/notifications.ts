import { queryOptions } from '@tanstack/react-query';
import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';
import type { NotificationsResponse } from '../types/notification';

export async function getNotifications(): Promise<NotificationsResponse> {
  const response = await apiClient.get<ApiSuccessResponse<NotificationsResponse>>(
    endpoints.notifications.list(),
  );
  return response.data;
}

export function notificationsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.notifications.list(),
    queryFn: getNotifications,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(endpoints.notifications.markRead(id), {});
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch(endpoints.notifications.markAllRead(), {});
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import {
  markAllNotificationsRead,
  notificationsQueryOptions,
  openNotification,
} from '../api/notifications';

export function useNotifications() {
  return useQuery(notificationsQueryOptions());
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useOpenNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: openNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

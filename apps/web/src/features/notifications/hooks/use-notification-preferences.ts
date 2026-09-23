import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationPreferences } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import {
  notificationPreferencesQueryOptions,
  updateNotificationPreferences,
} from '../api/notification-preferences';

/** Shared by every save, so the page can tell whether any is still in flight. */
export const UPDATE_NOTIFICATION_PREFERENCES_KEY = [
  ...queryKeys.notifications.preferences(),
  'update',
] as const;

export function useNotificationPreferences() {
  return useQuery(notificationPreferencesQueryOptions());
}

/**
 * Saves as soon as a switch moves, and moves the switch first: a toggle that
 * waits a round-trip to change feels broken. A failed save puts the switch
 * back.
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notifications.preferences();

  return useMutation({
    mutationKey: UPDATE_NOTIFICATION_PREFERENCES_KEY,
    mutationFn: updateNotificationPreferences,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey);

      if (previous) {
        const changes = new Map(input.preferences.map((change) => [change.kind, change]));
        queryClient.setQueryData<NotificationPreferences>(queryKey, {
          preferences: previous.preferences.map(
            (preference) => changes.get(preference.kind) ?? preference,
          ),
          channels: previous.channels,
        });
      }

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (saved) => {
      // With another save still out, its switch is already showing the newer
      // state; writing this older response over it would flick it back.
      if (queryClient.isMutating({ mutationKey: UPDATE_NOTIFICATION_PREFERENCES_KEY }) <= 1) {
        queryClient.setQueryData(queryKey, saved);
      }
    },
  });
}

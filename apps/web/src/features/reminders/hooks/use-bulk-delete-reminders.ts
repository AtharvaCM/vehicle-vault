import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { deleteReminder } from '../api/delete-reminder';

export function useBulkDeleteReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderIds: string[]) => {
      const uniqueReminderIds = Array.from(new Set(reminderIds));

      return Promise.all(uniqueReminderIds.map((reminderId) => deleteReminder(reminderId)));
    },
    onSuccess: () => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },
  });
}

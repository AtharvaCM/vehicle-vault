import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { completeReminder } from '../api/complete-reminder';

export function useBulkCompleteReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reminderIds: string[]) => {
      const uniqueReminderIds = Array.from(new Set(reminderIds));

      return Promise.all(uniqueReminderIds.map((reminderId) => completeReminder(reminderId)));
    },
    onSuccess: (reminders) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });

      reminders.forEach((reminder) => {
        queryClient.setQueryData(queryKeys.reminders.detail(reminder.id), reminder);
      });
    },
  });
}

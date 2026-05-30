import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { completeReminder } from '../api/complete-reminder';

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeReminder,
    onSuccess: (reminder) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
      queryClient.setQueryData(queryKeys.reminders.detail(reminder.id), reminder);
    },
  });
}

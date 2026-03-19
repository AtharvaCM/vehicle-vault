import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { completeReminder } from '../api/complete-reminder';

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeReminder,
    onSuccess: (reminder) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
      });
      queryClient.setQueryData(queryKeys.reminders.detail(reminder.id), reminder);
    },
  });
}

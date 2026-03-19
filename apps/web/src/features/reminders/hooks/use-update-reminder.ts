import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { updateReminder } from '../api/update-reminder';
import type { UpdateReminderInput } from '../types/reminder';

export function useUpdateReminder(reminderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateReminderInput) => updateReminder(reminderId, input),
    onSuccess: (reminder) => {
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

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { updateReminder } from '../api/update-reminder';
import type { UpdateReminderInput } from '../types/reminder';

export function useUpdateReminder(reminderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateReminderInput) => updateReminder(reminderId, input),
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

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { createReminder } from '../api/create-reminder';
import type { CreateReminderBody } from '../types/reminder';

export function useCreateReminder(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReminderBody) => createReminder(vehicleId, input),
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

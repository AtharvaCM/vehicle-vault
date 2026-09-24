import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import { snoozeReminder } from '../api/snooze-reminder';

export function useSnoozeReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: snoozeReminder,
    onSuccess: (reminder) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      queryClient.setQueryData(queryKeys.reminders.detail(reminder.id), reminder);
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { deleteReminder } from '../api/delete-reminder';

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReminder,
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

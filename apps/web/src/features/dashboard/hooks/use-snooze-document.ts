import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { snoozeDocument } from '../api/snooze-document';

export function useSnoozeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: snoozeDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

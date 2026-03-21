import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { reconcileAttachments } from '../api/reconcile-attachments';

export function useReconcileAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconcileAttachments,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },
  });
}

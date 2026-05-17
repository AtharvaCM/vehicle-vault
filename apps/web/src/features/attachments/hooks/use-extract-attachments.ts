import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { extractAttachments } from '../api/extract-attachments';

export function useExtractAttachments(recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentIds: string[]) => extractAttachments(recordId, attachmentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byRecord(recordId),
      });
    },
  });
}

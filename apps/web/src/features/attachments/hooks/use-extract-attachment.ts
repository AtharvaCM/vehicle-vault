import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { extractAttachment } from '../api/extract-attachment';

export function useExtractAttachment(recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => extractAttachment(attachmentId),
    onSuccess: (_extraction, attachmentId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byRecord(recordId),
      });
      // What a fill would write is worked out from the latest read.
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.fillPlan(attachmentId),
      });
    },
  });
}

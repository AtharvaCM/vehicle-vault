import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { applyAttachmentExtraction } from '../api/apply-attachment-extraction';

export function useApplyAttachmentExtraction(recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) => applyAttachmentExtraction(attachmentId),
    onSuccess: (record) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byRecord(recordId),
      });
      queryClient.setQueryData(queryKeys.maintenance.detail(record.id), record);
    },
  });
}

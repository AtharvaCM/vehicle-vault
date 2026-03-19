import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { uploadAttachments } from '../api/upload-attachments';

export function useUploadAttachments(recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => uploadAttachments(recordId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byRecord(recordId),
      });
    },
  });
}

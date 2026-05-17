import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteClaimAttachment,
  listClaimAttachments,
  uploadClaimAttachments,
} from '../api/claim-attachments';

const claimAttachmentsKey = (claimId: string) => ['claim-attachments', claimId] as const;

export function useClaimAttachments(claimId: string, enabled = true) {
  return useQuery({
    queryKey: claimAttachmentsKey(claimId),
    queryFn: () => listClaimAttachments(claimId),
    enabled,
  });
}

export function useUploadClaimAttachments(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => uploadClaimAttachments(claimId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimAttachmentsKey(claimId) });
    },
  });
}

export function useDeleteClaimAttachment(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteClaimAttachment(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimAttachmentsKey(claimId) });
    },
  });
}

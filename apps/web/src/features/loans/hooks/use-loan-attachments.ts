import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { deleteAttachment } from '@/features/attachments/api/delete-attachment';

import { loanAttachmentsQueryOptions, uploadLoanAttachments } from '../api/loan-attachments';

export function useLoanAttachments(loanId: string) {
  return useQuery(loanAttachmentsQueryOptions(loanId));
}

export function useUploadLoanAttachments(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => uploadLoanAttachments(loanId, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.vehicleLoans.attachments(loanId),
      });
    },
  });
}

export function useDeleteLoanAttachment(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.vehicleLoans.attachments(loanId),
      });
    },
  });
}

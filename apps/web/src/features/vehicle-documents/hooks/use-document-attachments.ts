import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAttachment } from '@/features/attachments/api/delete-attachment';
import { queryKeys } from '@/lib/query/query-keys';

import {
  getDocumentAttachments,
  uploadDocumentAttachments,
  type DocumentWithFilesKind,
} from '../api/document-attachments';

export function useDocumentAttachments(kind: DocumentWithFilesKind, documentId: string) {
  return useQuery({
    queryKey: queryKeys.attachments.byDocument(kind, documentId),
    queryFn: () => getDocumentAttachments(kind, documentId),
  });
}

export function useUploadDocumentAttachments(kind: DocumentWithFilesKind, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => uploadDocumentAttachments(kind, documentId, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byDocument(kind, documentId),
      });
    },
  });
}

export function useDeleteDocumentAttachment(kind: DocumentWithFilesKind, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byDocument(kind, documentId),
      });
    },
  });
}

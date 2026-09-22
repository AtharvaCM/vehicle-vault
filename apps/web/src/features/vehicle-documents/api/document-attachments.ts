import type { VehicleDocumentKind } from '@vehicle-vault/shared';
import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import type { Attachment } from '@/features/attachments/types/attachment';

/** Every document kind holds its own files. */
export type DocumentWithFilesKind = VehicleDocumentKind;

export async function getDocumentAttachments(kind: DocumentWithFilesKind, documentId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Attachment[]>>(
    endpoints.attachments.byDocument(kind, documentId),
  );
  return response.data;
}

export async function uploadDocumentAttachments(
  kind: DocumentWithFilesKind,
  documentId: string,
  files: File[],
) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await apiClient.post<ApiSuccessResponse<Attachment[]>, FormData>(
    endpoints.attachments.byDocument(kind, documentId),
    formData,
  );
  return response.data;
}

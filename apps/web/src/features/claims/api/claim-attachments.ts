import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import type { ClaimAttachment } from '@vehicle-vault/shared';

export async function listClaimAttachments(claimId: string) {
  const response = await apiClient.get<ApiSuccessResponse<ClaimAttachment[]>>(
    `claims/${claimId}/attachments`,
  );
  return response.data;
}

export async function uploadClaimAttachments(claimId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await apiClient.post<ApiSuccessResponse<ClaimAttachment[]>, FormData>(
    `claims/${claimId}/attachments`,
    formData,
  );
  return response.data;
}

export async function deleteClaimAttachment(attachmentId: string) {
  return apiClient.delete<ApiSuccessResponse<{ deleted: boolean }>>(
    `claim-attachments/${attachmentId}`,
  );
}

export function getClaimAttachmentFileUrl(attachmentId: string) {
  return `/api/claim-attachments/${attachmentId}/file`;
}

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import type { ClaimAttachment, ClaimExtractionSuggestion } from '@vehicle-vault/shared';

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

export async function getClaimExtractionStatus() {
  const response = await apiClient.get<ApiSuccessResponse<{ available: boolean }>>(
    'claim-attachments/extraction/status',
  );
  return response.data;
}

export async function extractClaimAttachment(attachmentId: string) {
  const response = await apiClient.post<
    ApiSuccessResponse<ClaimExtractionSuggestion>,
    undefined
  >(`claim-attachments/${attachmentId}/extract`);
  return response.data;
}

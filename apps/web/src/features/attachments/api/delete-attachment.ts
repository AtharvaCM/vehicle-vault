import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type DeleteAttachmentResponse = {
  id: string;
  deleted: true;
};

export async function deleteAttachment(attachmentId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<DeleteAttachmentResponse>>(
    endpoints.attachments.delete(attachmentId),
  );

  return response.data;
}

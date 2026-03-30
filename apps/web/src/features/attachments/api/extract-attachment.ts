import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { AttachmentExtraction } from '../types/attachment';

export async function extractAttachment(attachmentId: string) {
  const response = await apiClient.post<ApiSuccessResponse<AttachmentExtraction>, undefined>(
    endpoints.attachments.extract(attachmentId),
  );

  return response.data;
}

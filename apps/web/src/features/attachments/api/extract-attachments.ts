import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { AttachmentExtraction } from '../types/attachment';

export async function extractAttachments(recordId: string, attachmentIds: string[]) {
  const response = await apiClient.post<
    ApiSuccessResponse<AttachmentExtraction>,
    { attachmentIds: string[] }
  >(endpoints.attachments.extractBatch(recordId), { attachmentIds });

  return response.data;
}

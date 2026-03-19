import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Attachment } from '../types/attachment';

export async function getAttachmentById(attachmentId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Attachment>>(
    endpoints.attachments.detail(attachmentId),
  );

  return response.data;
}

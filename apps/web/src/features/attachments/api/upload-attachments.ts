import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Attachment } from '../types/attachment';

export async function uploadAttachments(recordId: string, files: File[]) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await apiClient.post<ApiSuccessResponse<Attachment[]>, FormData>(
    endpoints.attachments.upload(recordId),
    formData,
  );

  return response.data;
}

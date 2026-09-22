import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { MaintenanceFillResult } from '../types/attachment';

export async function fillFromAttachment(attachmentId: string) {
  const response = await apiClient.post<ApiSuccessResponse<MaintenanceFillResult>, undefined>(
    endpoints.attachments.fill(attachmentId),
  );

  return response.data;
}

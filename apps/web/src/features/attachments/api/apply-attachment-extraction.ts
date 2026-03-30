import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { MaintenanceRecord } from '@/features/maintenance/types/maintenance-record';

export async function applyAttachmentExtraction(attachmentId: string) {
  const response = await apiClient.post<ApiSuccessResponse<MaintenanceRecord>, undefined>(
    endpoints.attachments.applyExtraction(attachmentId),
  );

  return response.data;
}

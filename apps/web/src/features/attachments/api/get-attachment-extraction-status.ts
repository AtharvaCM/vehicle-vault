import { queryOptions } from '@tanstack/react-query';
import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { AttachmentExtractionStatusResponse } from '../types/attachment';

export async function getAttachmentExtractionStatus() {
  const response = await apiClient.get<ApiSuccessResponse<AttachmentExtractionStatusResponse>>(
    endpoints.attachments.extractionStatus,
  );

  return response.data;
}

export function attachmentExtractionStatusQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.attachments.extractionStatus(),
    queryFn: () => getAttachmentExtractionStatus(),
  });
}

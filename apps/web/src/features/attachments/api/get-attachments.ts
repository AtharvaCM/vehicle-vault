import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { Attachment } from '../types/attachment';

export async function getAttachments(recordId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Attachment[]>>(
    endpoints.attachments.byRecord(recordId),
  );

  return response.data;
}

export function attachmentsQueryOptions(recordId: string) {
  return queryOptions({
    queryKey: queryKeys.attachments.byRecord(recordId),
    queryFn: () => getAttachments(recordId),
  });
}

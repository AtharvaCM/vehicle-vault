import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceFillPlan } from '../types/attachment';

export async function getFillPlan(attachmentId: string) {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceFillPlan>>(
    endpoints.attachments.fill(attachmentId),
  );

  return response.data;
}

export function fillPlanQueryOptions(attachmentId: string) {
  return queryOptions({
    queryKey: queryKeys.attachments.fillPlan(attachmentId),
    queryFn: () => getFillPlan(attachmentId),
    // Worked out from the record as it is now, which an edit elsewhere may have changed.
    staleTime: 0,
  });
}

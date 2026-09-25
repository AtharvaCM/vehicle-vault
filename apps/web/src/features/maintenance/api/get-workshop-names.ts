import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

/** The workshops on the owner's confirmed service records, most recently used first. */
export async function getWorkshopNames() {
  const response = await apiClient.get<ApiSuccessResponse<string[]>>(
    endpoints.maintenance.workshops,
  );

  return response.data;
}

export function workshopNamesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.maintenance.workshops(),
    queryFn: getWorkshopNames,
  });
}

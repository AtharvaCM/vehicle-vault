import { queryOptions } from '@tanstack/react-query';
import type { TcoResponse } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getTco(vehicleId: string): Promise<TcoResponse> {
  const response = await apiClient.get<ApiSuccessResponse<TcoResponse>>(
    endpoints.analytics.tco(vehicleId),
  );
  return response.data;
}

export function tcoQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.analytics.tco(vehicleId),
    queryFn: () => getTco(vehicleId),
  });
}

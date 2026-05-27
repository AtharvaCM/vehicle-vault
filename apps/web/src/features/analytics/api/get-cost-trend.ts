import { queryOptions } from '@tanstack/react-query';
import type { CostTrendResponse } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type CostTrendParams = {
  vehicleId?: string;
  from?: string;
  to?: string;
};

export async function getCostTrend(params: CostTrendParams = {}): Promise<CostTrendResponse> {
  const search = new URLSearchParams();
  if (params.vehicleId) search.set('vehicleId', params.vehicleId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);

  const query = search.toString();
  const url = query ? `${endpoints.analytics.costTrend}?${query}` : endpoints.analytics.costTrend;

  const response = await apiClient.get<ApiSuccessResponse<CostTrendResponse>>(url);
  return response.data;
}

export function costTrendQueryOptions(params: CostTrendParams = {}) {
  return queryOptions({
    queryKey: queryKeys.analytics.costTrend(params),
    queryFn: () => getCostTrend(params),
  });
}

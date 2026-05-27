import { queryOptions } from '@tanstack/react-query';
import type { CostSplitResponse } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type CostSplitParams = {
  vehicleId?: string;
  from?: string;
  to?: string;
};

export async function getCostSplit(params: CostSplitParams = {}): Promise<CostSplitResponse> {
  const search = new URLSearchParams();
  if (params.vehicleId) search.set('vehicleId', params.vehicleId);
  if (params.from) search.set('from', params.from);
  if (params.to) search.set('to', params.to);

  const query = search.toString();
  const url = query ? `${endpoints.analytics.costSplit}?${query}` : endpoints.analytics.costSplit;

  const response = await apiClient.get<ApiSuccessResponse<CostSplitResponse>>(url);
  return response.data;
}

export function costSplitQueryOptions(params: CostSplitParams = {}) {
  return queryOptions({
    queryKey: queryKeys.analytics.costSplit(params),
    queryFn: () => getCostSplit(params),
  });
}

import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { DashboardSummary } from '../types/dashboard';

export async function getDashboardSummary() {
  const response = await apiClient.get<ApiSuccessResponse<DashboardSummary>>(
    endpoints.dashboard.summary,
  );

  return response.data;
}

export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: getDashboardSummary,
  });
}

import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { DashboardSummary } from '../types/dashboard';

export async function getDashboardSummary() {
  return apiClient.get<DashboardSummary>(endpoints.dashboard.summary);
}

export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: getDashboardSummary,
  });
}

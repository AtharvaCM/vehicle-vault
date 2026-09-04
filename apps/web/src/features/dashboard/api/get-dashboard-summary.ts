import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { DashboardAttentionCounts, DashboardSummary } from '../types/dashboard';

type RollupFields = 'attention' | 'attentionTotal' | 'attentionCounts' | 'vehicles' | 'vehiclesTotal' | 'hasSpend';

/** What an API that predates the dashboard rollups still sends. */
export type LegacyDashboardSummary = Omit<DashboardSummary, RollupFields> &
  Partial<Pick<DashboardSummary, RollupFields>>;

const EMPTY_ATTENTION_COUNTS: DashboardAttentionCounts = {
  overdue: 0,
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
  documentsExpiring30d: 0,
  vehiclesNeedingAttention: 0,
  total: 0,
};

/**
 * The web deploys automatically while the API image is redeployed by hand, so for a
 * window the new page can be served by the previous API. Default the rollup fields so
 * the dashboard degrades to an empty queue instead of crashing on `undefined.filter`.
 */
export function normalizeDashboardSummary(raw: LegacyDashboardSummary): DashboardSummary {
  const attention = raw.attention ?? [];
  const vehicles = raw.vehicles ?? [];

  return {
    ...raw,
    attention,
    attentionTotal: raw.attentionTotal ?? attention.length,
    attentionCounts: raw.attentionCounts ?? EMPTY_ATTENTION_COUNTS,
    vehicles,
    vehiclesTotal: raw.vehiclesTotal ?? (raw.vehicles ? vehicles.length : raw.totalVehicles),
    hasSpend: raw.hasSpend ?? (raw.totalMaintenanceRecords > 0 || raw.loans.activeCount > 0),
  };
}

export async function getDashboardSummary() {
  const response = await apiClient.get<ApiSuccessResponse<LegacyDashboardSummary>>(
    endpoints.dashboard.summary,
  );

  return normalizeDashboardSummary(response.data);
}

export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: getDashboardSummary,
  });
}

import { useQuery } from '@tanstack/react-query';

import { dashboardSummaryQueryOptions } from '../api/get-dashboard-summary';

export function useDashboardSummary() {
  return useQuery(dashboardSummaryQueryOptions());
}

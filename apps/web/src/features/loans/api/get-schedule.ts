import { queryOptions } from '@tanstack/react-query';
import type { AmortizationPoint } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getSchedule(loanId: string) {
  const response = await apiClient.get<ApiSuccessResponse<AmortizationPoint[]>>(
    endpoints.vehicleLoans.schedule(loanId),
  );
  return response.data;
}

export function loanScheduleQueryOptions(loanId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleLoans.schedule(loanId),
    queryFn: () => getSchedule(loanId),
    enabled: Boolean(loanId),
  });
}

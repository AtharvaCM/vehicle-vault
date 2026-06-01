import { queryOptions } from '@tanstack/react-query';
import type { VehicleLoan } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getLoans() {
  const response = await apiClient.get<ApiSuccessResponse<VehicleLoan[]>>(
    endpoints.vehicleLoans.list,
  );
  return response.data;
}

export async function getLoansByVehicle(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleLoan[]>>(
    endpoints.vehicleLoans.byVehicle(vehicleId),
  );
  return response.data;
}

export function loansQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.vehicleLoans.list(),
    queryFn: getLoans,
  });
}

export function vehicleLoansQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleLoans.byVehicle(vehicleId),
    queryFn: () => getLoansByVehicle(vehicleId),
  });
}

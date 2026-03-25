import { queryOptions } from '@tanstack/react-query';
import type { FuelLog } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getFuelLogs(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<FuelLog[]>>(
    endpoints.fuelLogs.byVehicle(vehicleId),
  );

  return response.data;
}

export function fuelLogsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicles.fuelLogs(vehicleId),
    queryFn: () => getFuelLogs(vehicleId),
  });
}

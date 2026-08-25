import { queryOptions } from '@tanstack/react-query';
import type { Tyre, VehicleTyreCondition } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getVehicleTyres(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Tyre[]>>(
    endpoints.tyres.list(vehicleId),
  );

  return response.data;
}

export function vehicleTyresQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.tyres.all(vehicleId),
    queryFn: () => getVehicleTyres(vehicleId),
    enabled: vehicleId.length > 0,
  });
}

export async function getVehicleTyreCondition(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleTyreCondition>>(
    endpoints.tyres.condition(vehicleId),
  );

  return response.data;
}

export function vehicleTyreConditionQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.tyres.condition(vehicleId),
    queryFn: () => getVehicleTyreCondition(vehicleId),
    enabled: vehicleId.length > 0,
  });
}

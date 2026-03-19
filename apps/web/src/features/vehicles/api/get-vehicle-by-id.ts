import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { Vehicle } from '../types/vehicle';

export async function getVehicleById(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Vehicle>>(
    endpoints.vehicles.detail(vehicleId),
  );

  return response.data;
}

export function vehicleDetailQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicles.detail(vehicleId),
    queryFn: () => getVehicleById(vehicleId),
  });
}

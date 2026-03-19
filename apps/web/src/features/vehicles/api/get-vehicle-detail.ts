import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { VehicleSummary } from '../types/vehicle';

export async function getVehicleDetail(vehicleId: string) {
  return apiClient.get<VehicleSummary>(endpoints.vehicles.detail(vehicleId));
}

export function vehicleDetailQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicles.detail(vehicleId),
    queryFn: () => getVehicleDetail(vehicleId),
  });
}

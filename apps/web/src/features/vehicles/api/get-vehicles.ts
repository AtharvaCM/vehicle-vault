import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { VehicleSummary } from '../types/vehicle';

export async function getVehicles() {
  return apiClient.get<VehicleSummary[]>(endpoints.vehicles.list);
}

export function vehiclesListQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.vehicles.list(),
    queryFn: getVehicles,
  });
}

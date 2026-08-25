import { queryOptions } from '@tanstack/react-query';
import type { VehicleServiceIntervalMap } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getVehicleIntervals(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleServiceIntervalMap>>(
    endpoints.vehicles.intervals(vehicleId),
  );

  return response.data;
}

export function vehicleIntervalsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicles.intervals(vehicleId),
    queryFn: () => getVehicleIntervals(vehicleId),
    // The tyre tab renders before the vehicle resolves, so guard against a
    // request for an empty id.
    enabled: vehicleId.length > 0,
    // Intervals change only when the vehicle is relinked to a different catalog
    // variant, so refetching them per mount is wasted work.
    staleTime: 30 * 60 * 1000,
  });
}

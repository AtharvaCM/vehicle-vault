import { queryOptions } from '@tanstack/react-query';
import type { MaintenanceSuggestion } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type { MaintenanceSuggestion };

export async function getVehicleForecast(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceSuggestion[]>>(
    endpoints.vehicles.forecast(vehicleId),
  );

  return response.data;
}

export function vehicleForecastQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: [...queryKeys.vehicles.detail(vehicleId), 'forecast'],
    queryFn: () => getVehicleForecast(vehicleId),
  });
}

import { queryOptions } from '@tanstack/react-query';
import { MaintenanceCategory } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type MaintenanceSuggestion = {
  category: MaintenanceCategory;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  estimatedOdometerDue?: number;
  estimatedDateDue?: string;
};

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

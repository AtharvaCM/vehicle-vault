import type { VehicleFuelEconomy } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function getVehicleFuelEconomy(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleFuelEconomy>>(
    endpoints.vehicles.fuelEconomy(vehicleId),
  );

  return response.data;
}

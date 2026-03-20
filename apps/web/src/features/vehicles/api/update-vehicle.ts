import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { UpdateVehicleInput, Vehicle } from '../types/vehicle';

export async function updateVehicle(vehicleId: string, input: UpdateVehicleInput) {
  const response = await apiClient.patch<ApiSuccessResponse<Vehicle>, UpdateVehicleInput>(
    endpoints.vehicles.detail(vehicleId),
    input,
  );

  return response.data;
}

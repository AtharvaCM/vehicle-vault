import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { CreateVehicleInput, Vehicle } from '../types/vehicle';

export async function createVehicle(input: CreateVehicleInput) {
  const response = await apiClient.post<ApiSuccessResponse<Vehicle>, CreateVehicleInput>(
    endpoints.vehicles.create,
    input,
  );

  return response.data;
}

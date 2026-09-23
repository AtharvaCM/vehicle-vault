import type { CreateVehicleRequest } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Vehicle } from '../types/vehicle';

export async function createVehicle(input: CreateVehicleRequest) {
  const response = await apiClient.post<ApiSuccessResponse<Vehicle>, CreateVehicleRequest>(
    endpoints.vehicles.create,
    input,
  );

  return response.data;
}

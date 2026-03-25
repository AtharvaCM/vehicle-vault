import type { CreateFuelLogInput, FuelLog } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function createFuelLog(vehicleId: string, input: CreateFuelLogInput) {
  const response = await apiClient.post<ApiSuccessResponse<FuelLog>, CreateFuelLogInput>(
    endpoints.fuelLogs.create(vehicleId),
    input,
  );

  return response.data;
}

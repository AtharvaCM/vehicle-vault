import type { FuelLog, UpdateFuelLogInput } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function updateFuelLog(id: string, input: UpdateFuelLogInput) {
  const response = await apiClient.patch<ApiSuccessResponse<FuelLog>, UpdateFuelLogInput>(
    endpoints.fuelLogs.update(id),
    input,
  );

  return response.data;
}

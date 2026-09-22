import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Vehicle } from '../types/vehicle';

/** Put away the expiry prompt a new vehicle lands on, answered or skipped. */
export async function dismissVehicleSetupPrompt(vehicleId: string) {
  const response = await apiClient.post<ApiSuccessResponse<Vehicle>, undefined>(
    endpoints.vehicles.dismissSetupPrompt(vehicleId),
    undefined,
  );

  return response.data;
}

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { Vehicle } from '../types/vehicle';

/** Record a new reading. The API refuses one below the stored odometer. */
export async function updateVehicleOdometer(vehicleId: string, odometer: number) {
  const response = await apiClient.patch<ApiSuccessResponse<Vehicle>, { odometer: number }>(
    endpoints.vehicles.odometer(vehicleId),
    { odometer },
  );

  return response.data;
}

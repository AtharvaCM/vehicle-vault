import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type DeleteVehicleResponse = {
  id: string;
  deleted: true;
};

export async function deleteVehicle(vehicleId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<DeleteVehicleResponse>>(
    endpoints.vehicles.detail(vehicleId),
  );

  return response.data;
}

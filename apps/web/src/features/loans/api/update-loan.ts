import type { UpdateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function updateLoan(id: string, input: UpdateVehicleLoanInput) {
  const response = await apiClient.patch<ApiSuccessResponse<VehicleLoan>, UpdateVehicleLoanInput>(
    endpoints.vehicleLoans.update(id),
    input,
  );
  return response.data;
}

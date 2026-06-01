import type { CreateVehicleLoanInput, VehicleLoan } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function createLoan(vehicleId: string, input: CreateVehicleLoanInput) {
  const response = await apiClient.post<ApiSuccessResponse<VehicleLoan>, CreateVehicleLoanInput>(
    endpoints.vehicleLoans.create(vehicleId),
    input,
  );
  return response.data;
}

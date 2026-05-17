import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import {
  type Claim,
  type CreateClaimInput,
  type UpdateClaimInput,
} from '@vehicle-vault/shared';

export async function listClaimsForVehicle(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Claim[]>>(
    `vehicles/${vehicleId}/claims`,
  );
  return response.data;
}

export async function createClaim(vehicleId: string, data: CreateClaimInput) {
  const response = await apiClient.post<ApiSuccessResponse<Claim>, CreateClaimInput>(
    `vehicles/${vehicleId}/claims`,
    data,
  );
  return response.data;
}

export async function updateClaim(id: string, data: UpdateClaimInput) {
  const response = await apiClient.patch<ApiSuccessResponse<Claim>, UpdateClaimInput>(
    `claims/${id}`,
    data,
  );
  return response.data;
}

export async function deleteClaim(id: string) {
  return apiClient.delete<ApiSuccessResponse<{ removed: boolean }>>(`claims/${id}`);
}

import type { CreateTyreInput, CreateTyreInspectionInput, Tyre, TyreInspection } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function createTyre(vehicleId: string, body: CreateTyreInput) {
  const response = await apiClient.post<ApiSuccessResponse<Tyre>, CreateTyreInput>(
    endpoints.tyres.create(vehicleId),
    body,
  );

  return response.data;
}

export async function createTyreInspection(
  vehicleId: string,
  body: CreateTyreInspectionInput,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<TyreInspection>,
    CreateTyreInspectionInput
  >(endpoints.tyres.createInspection(vehicleId), body);

  return response.data;
}

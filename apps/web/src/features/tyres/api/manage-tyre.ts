import type { Tyre, UpdateTyreInput } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function updateTyre(tyreId: string, body: UpdateTyreInput) {
  const response = await apiClient.patch<ApiSuccessResponse<Tyre>, UpdateTyreInput>(
    endpoints.tyres.update(tyreId),
    body,
  );

  return response.data;
}

export async function deleteTyre(tyreId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<{ id: string }>>(
    endpoints.tyres.remove(tyreId),
  );

  return response.data;
}

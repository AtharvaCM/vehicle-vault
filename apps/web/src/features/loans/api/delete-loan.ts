import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function deleteLoan(id: string) {
  const response = await apiClient.delete<ApiSuccessResponse<{ id: string; deleted: true }>>(
    endpoints.vehicleLoans.delete(id),
  );
  return response.data;
}

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type DeleteMaintenanceRecordResponse = {
  id: string;
  deleted: true;
};

export async function deleteMaintenanceRecord(recordId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<DeleteMaintenanceRecordResponse>>(
    endpoints.maintenance.delete(recordId),
  );

  return response.data;
}

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { MaintenanceRecord } from '../types/maintenance-record';

export async function createMaintenanceDraft(vehicleId: string) {
  const response = await apiClient.post<ApiSuccessResponse<MaintenanceRecord>, undefined>(
    endpoints.maintenance.createDraft(vehicleId),
  );

  return response.data;
}

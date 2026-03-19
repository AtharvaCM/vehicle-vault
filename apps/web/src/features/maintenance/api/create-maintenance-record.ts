import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { CreateMaintenanceRecordBody, MaintenanceRecord } from '../types/maintenance-record';

export async function createMaintenanceRecord(
  vehicleId: string,
  input: CreateMaintenanceRecordBody,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<MaintenanceRecord>,
    CreateMaintenanceRecordBody
  >(endpoints.maintenance.create(vehicleId), input);

  return response.data;
}

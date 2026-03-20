import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

import type { MaintenanceRecord, UpdateMaintenanceRecordInput } from '../types/maintenance-record';

export async function updateMaintenanceRecord(
  recordId: string,
  input: UpdateMaintenanceRecordInput,
) {
  const response = await apiClient.patch<
    ApiSuccessResponse<MaintenanceRecord>,
    UpdateMaintenanceRecordInput
  >(endpoints.maintenance.update(recordId), input);

  return response.data;
}

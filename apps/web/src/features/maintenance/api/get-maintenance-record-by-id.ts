import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceRecord } from '../types/maintenance-record';

export async function getMaintenanceRecordById(recordId: string) {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceRecord>>(
    endpoints.maintenance.detail(recordId),
  );

  return response.data;
}

export function maintenanceRecordDetailQueryOptions(recordId: string) {
  return queryOptions({
    queryKey: queryKeys.maintenance.detail(recordId),
    queryFn: () => getMaintenanceRecordById(recordId),
  });
}

import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceRecord } from '../types/maintenance-record';

export async function getAllMaintenanceRecords() {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceRecord[]>>(
    endpoints.maintenance.all,
  );

  return response.data;
}

export function allMaintenanceRecordsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.maintenance.global(),
    queryFn: getAllMaintenanceRecords,
  });
}

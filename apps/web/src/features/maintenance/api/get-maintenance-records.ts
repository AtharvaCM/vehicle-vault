import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceRecord } from '../types/maintenance-record';

export async function getMaintenanceRecords(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceRecord[]>>(
    endpoints.maintenance.list(vehicleId),
  );

  return response.data;
}

export function maintenanceRecordsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.maintenance.list(vehicleId),
    queryFn: () => getMaintenanceRecords(vehicleId),
  });
}

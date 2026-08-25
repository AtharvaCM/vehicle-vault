import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceRecord } from '../types/maintenance-record';

/**
 * The endpoint is paginated and defaults to 20 rows. Every consumer here treats
 * the result as a vehicle's whole history, so an unqualified request silently
 * hid older records — long enough a service log would push the last tyre
 * rotation off the page and make a maintained vehicle look neglected. 100 is the
 * ceiling `PaginationQueryDto` allows; past that this needs a category filter or
 * a cursor rather than a bigger number.
 */
const MAINTENANCE_PAGE_LIMIT = 100;

export async function getMaintenanceRecords(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<MaintenanceRecord[]>>(
    endpoints.maintenance.list(vehicleId),
    { query: { limit: MAINTENANCE_PAGE_LIMIT } },
  );

  return response.data;
}

export function maintenanceRecordsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.maintenance.list(vehicleId),
    queryFn: () => getMaintenanceRecords(vehicleId),
  });
}

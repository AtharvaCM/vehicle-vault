import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { MaintenanceRecord } from '../types/maintenance-record';

export async function getVehicleMaintenance(vehicleId: string) {
  return apiClient.get<MaintenanceRecord[]>(endpoints.maintenance.list(vehicleId));
}

export function vehicleMaintenanceQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.maintenance.list(vehicleId),
    queryFn: () => getVehicleMaintenance(vehicleId),
  });
}

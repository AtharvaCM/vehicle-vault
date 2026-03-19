import { useQuery } from '@tanstack/react-query';

import { maintenanceRecordsQueryOptions } from '../api/get-maintenance-records';

export function useMaintenanceRecords(vehicleId: string) {
  return useQuery(maintenanceRecordsQueryOptions(vehicleId));
}

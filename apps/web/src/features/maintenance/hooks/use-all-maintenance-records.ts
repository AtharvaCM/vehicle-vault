import { useQuery } from '@tanstack/react-query';

import { allMaintenanceRecordsQueryOptions } from '../api/get-all-maintenance-records';

export function useAllMaintenanceRecords() {
  return useQuery(allMaintenanceRecordsQueryOptions());
}

import { useQuery } from '@tanstack/react-query';

import { maintenanceRecordDetailQueryOptions } from '../api/get-maintenance-record-by-id';

export function useMaintenanceRecord(recordId: string) {
  return useQuery(maintenanceRecordDetailQueryOptions(recordId));
}

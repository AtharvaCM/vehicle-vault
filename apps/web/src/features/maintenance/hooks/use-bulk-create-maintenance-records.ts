import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';

type BulkCreateMaintenanceRecordsResponse = {
  count: number;
};

async function createBulkMaintenanceRecords(
  vehicleId: string,
  records: CreateMaintenanceRecordBody[],
) {
  const response = await apiClient.post<
    ApiSuccessResponse<BulkCreateMaintenanceRecordsResponse>,
    { records: CreateMaintenanceRecordBody[] }
  >(endpoints.maintenance.bulk(vehicleId), { records });

  return response.data;
}

export function useBulkCreateMaintenanceRecords(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (records: CreateMaintenanceRecordBody[]) =>
      createBulkMaintenanceRecords(vehicleId, records),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.list(vehicleId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.all(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(),
      });
    },
  });
}

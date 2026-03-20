import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { updateMaintenanceRecord } from '../api/update-maintenance-record';
import type { UpdateMaintenanceRecordInput } from '../types/maintenance-record';

export function useUpdateMaintenanceRecord(recordId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMaintenanceRecordInput) =>
      updateMaintenanceRecord(recordId, input),
    onSuccess: (record) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
      queryClient.setQueryData(queryKeys.maintenance.detail(record.id), record);
    },
  });
}

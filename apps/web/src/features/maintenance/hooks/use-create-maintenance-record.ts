import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { createMaintenanceRecord } from '../api/create-maintenance-record';
import type { CreateMaintenanceRecordBody } from '../types/maintenance-record';

export function useCreateMaintenanceRecord(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMaintenanceRecordBody) => createMaintenanceRecord(vehicleId, input),
    onSuccess: (record) => {
      void invalidateAudit(queryClient);
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

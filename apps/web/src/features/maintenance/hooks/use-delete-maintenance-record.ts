import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { deleteMaintenanceRecord } from '../api/delete-maintenance-record';

export function useDeleteMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMaintenanceRecord,
    onSuccess: () => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { deleteMaintenanceRecord } from '../api/delete-maintenance-record';

export function useBulkDeleteMaintenanceRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordIds: string[]) => {
      const uniqueIds = [...new Set(recordIds)];

      await Promise.all(uniqueIds.map((recordId) => deleteMaintenanceRecord(recordId)));

      return uniqueIds;
    },
    onSuccess: () => {
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

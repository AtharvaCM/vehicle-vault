import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { createMaintenanceDraft } from '../api/create-maintenance-draft';

export function useCreateMaintenanceDraft(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createMaintenanceDraft(vehicleId),
    onSuccess: (record) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.all(),
      });
      queryClient.setQueryData(queryKeys.maintenance.detail(record.id), record);
    },
  });
}

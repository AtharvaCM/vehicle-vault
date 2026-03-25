import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { deleteFuelLog } from '../api/delete-fuel-log';

export function useDeleteFuelLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logId: string) => deleteFuelLog(logId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.fuelLogs(vehicleId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(),
      });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateFuelLogInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { updateFuelLog } from '../api/update-fuel-log';

export function useUpdateFuelLog(vehicleId: string, logId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateFuelLogInput) => updateFuelLog(logId, input),
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

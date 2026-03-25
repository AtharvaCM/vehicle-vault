import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateFuelLogInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { createFuelLog } from '../api/create-fuel-log';

export function useCreateFuelLog(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFuelLogInput) => createFuelLog(vehicleId, input),
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

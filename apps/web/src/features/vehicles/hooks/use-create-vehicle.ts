import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';
import { invalidateAudit } from '@/lib/query/invalidate-audit';

import { createVehicle } from '../api/create-vehicle';

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: (vehicle) => {
      void invalidateAudit(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
      queryClient.setQueryData(queryKeys.vehicles.detail(vehicle.id), vehicle);
    },
  });
}

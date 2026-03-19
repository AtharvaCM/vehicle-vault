import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { createVehicle } from '../api/create-vehicle';

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVehicle,
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.all(),
      });
      queryClient.setQueryData(queryKeys.vehicles.detail(vehicle.id), vehicle);
    },
  });
}

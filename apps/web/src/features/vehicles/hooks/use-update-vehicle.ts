import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { updateVehicle } from '../api/update-vehicle';
import type { UpdateVehicleInput } from '../types/vehicle';

export function useUpdateVehicle(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateVehicleInput) => updateVehicle(vehicleId, input),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(),
      });
      queryClient.setQueryData(queryKeys.vehicles.detail(vehicle.id), vehicle);
    },
  });
}

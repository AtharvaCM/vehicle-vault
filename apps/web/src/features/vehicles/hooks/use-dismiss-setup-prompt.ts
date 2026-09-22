import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { dismissVehicleSetupPrompt } from '../api/dismiss-setup-prompt';

export function useDismissVehicleSetupPrompt(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => dismissVehicleSetupPrompt(vehicleId),
    onSuccess: (vehicle) => {
      queryClient.setQueryData(queryKeys.vehicles.detail(vehicle.id), vehicle);
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all() });
    },
  });
}

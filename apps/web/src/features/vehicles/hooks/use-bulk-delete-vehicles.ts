import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { deleteVehicle } from '../api/delete-vehicle';

export function useBulkDeleteVehicles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicleIds: string[]) => {
      const uniqueIds = [...new Set(vehicleIds)];

      await Promise.all(uniqueIds.map((vehicleId) => deleteVehicle(vehicleId)));

      return uniqueIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.maintenance.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reminders.all(),
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

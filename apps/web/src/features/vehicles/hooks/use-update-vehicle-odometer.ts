import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAudit } from '@/lib/query/invalidate-audit';
import { queryKeys } from '@/lib/query/query-keys';

import { updateVehicleOdometer } from '../api/update-vehicle-odometer';

export function useUpdateVehicleOdometer(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (odometer: number) => updateVehicleOdometer(vehicleId, odometer),
    onSuccess: (vehicle) => {
      void invalidateAudit(queryClient);
      // Everything measured from the odometer: the vehicle and its forecast
      // (nested under its detail key), km-based reminders, and the dashboard.
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      queryClient.setQueryData(queryKeys.vehicles.detail(vehicle.id), vehicle);
    },
  });
}

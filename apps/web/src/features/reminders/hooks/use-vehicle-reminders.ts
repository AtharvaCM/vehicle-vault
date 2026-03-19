import { useQuery } from '@tanstack/react-query';

import { vehicleRemindersQueryOptions } from '../api/get-vehicle-reminders';

export function useVehicleReminders(vehicleId: string) {
  return useQuery(vehicleRemindersQueryOptions(vehicleId));
}

import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { Reminder } from '../types/reminder';

export async function getVehicleReminders(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Reminder[]>>(
    endpoints.reminders.byVehicle(vehicleId),
  );

  return response.data;
}

export function vehicleRemindersQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.reminders.byVehicle(vehicleId),
    queryFn: () => getVehicleReminders(vehicleId),
  });
}

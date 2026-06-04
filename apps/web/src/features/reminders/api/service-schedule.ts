import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

import type { ServiceScheduleSuggestion } from '../types/service-schedule';

export async function getServiceScheduleSuggestions(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<ServiceScheduleSuggestion[]>>(
    endpoints.reminders.scheduleSuggestions(vehicleId),
  );
  return response.data;
}

export async function applyServiceSchedule(vehicleId: string, slugs: string[]) {
  const response = await apiClient.post<
    ApiSuccessResponse<{ created: string[] }>,
    { slugs: string[] }
  >(endpoints.reminders.applySchedule(vehicleId), { slugs });
  return response.data;
}

export function serviceScheduleSuggestionsQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.reminders.scheduleSuggestions(vehicleId),
    queryFn: () => getServiceScheduleSuggestions(vehicleId),
  });
}

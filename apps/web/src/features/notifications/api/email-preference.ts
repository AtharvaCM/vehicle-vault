import { queryOptions } from '@tanstack/react-query';

import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export interface AlertEmailPreference {
  muted: boolean;
  /** ISO timestamp of the mute, or null when alert email is on. */
  mutedAt: string | null;
}

export async function getAlertEmailPreference(): Promise<AlertEmailPreference> {
  const response = await apiClient.get<ApiSuccessResponse<AlertEmailPreference>>(
    endpoints.notifications.emailPreference(),
  );
  return response.data;
}

export function alertEmailPreferenceQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.notifications.emailPreference(),
    queryFn: getAlertEmailPreference,
  });
}

export async function setAlertEmailPreference(muted: boolean): Promise<AlertEmailPreference> {
  const response = await apiClient.patch<
    ApiSuccessResponse<AlertEmailPreference>,
    { muted: boolean }
  >(endpoints.notifications.emailPreference(), { muted });
  return response.data;
}

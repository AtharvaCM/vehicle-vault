import type { HistoryKind, HistoryPage } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export type HistoryFilters = {
  vehicleId?: string;
  kind?: HistoryKind;
  search?: string;
};

export async function getHistory(filters: HistoryFilters, cursor?: string) {
  const response = await apiClient.get<ApiSuccessResponse<HistoryPage>>(endpoints.history.list, {
    query: { vehicleId: filters.vehicleId, kind: filters.kind, search: filters.search, cursor },
  });

  return response.data;
}

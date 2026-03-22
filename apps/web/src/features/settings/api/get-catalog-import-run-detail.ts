import { queryOptions } from '@tanstack/react-query';
import type { VehicleCatalogImportRunDetail } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getCatalogImportRunDetail(runId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleCatalogImportRunDetail>>(
    endpoints.vehicleCatalog.importRunDetail(runId),
  );

  return response.data;
}

export function catalogImportRunDetailQueryOptions(runId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleCatalog.importRunDetail(runId),
    queryFn: () => getCatalogImportRunDetail(runId),
  });
}

import { queryOptions } from '@tanstack/react-query';
import type { VehicleCatalogImportRunReview } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getCatalogImportRuns() {
  const response = await apiClient.get<ApiSuccessResponse<VehicleCatalogImportRunReview[]>>(
    endpoints.vehicleCatalog.importRuns,
  );

  return response.data;
}

export function catalogImportRunsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.vehicleCatalog.importRuns(),
    queryFn: getCatalogImportRuns,
  });
}

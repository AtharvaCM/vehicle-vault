import type { VehicleCatalogImportRunReview } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';

export async function archiveMissingCatalogImportRun(runId: string) {
  const response = await apiClient.post<ApiSuccessResponse<VehicleCatalogImportRunReview>, void>(
    endpoints.vehicleCatalog.archiveMissingImportRun(runId),
  );

  return response.data;
}

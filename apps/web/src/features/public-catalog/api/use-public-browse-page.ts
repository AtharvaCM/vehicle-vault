import { useQuery } from '@tanstack/react-query';
import type { PublicCatalogBrowsePage, PublicCatalogSegment } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getPublicBrowsePage(segment: PublicCatalogSegment) {
  const response = await apiClient.get<ApiSuccessResponse<PublicCatalogBrowsePage>>(
    endpoints.publicCatalog.browse(segment),
    { skipAuthRefresh: true, skipUnauthorizedHandler: true },
  );
  return response.data;
}

export function usePublicBrowsePage(segment: PublicCatalogSegment) {
  return useQuery({
    queryKey: queryKeys.publicCatalog.browse(segment),
    queryFn: () => getPublicBrowsePage(segment),
    // The catalog changes only when an import run is published.
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

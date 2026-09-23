import { useQuery } from '@tanstack/react-query';
import type { PublicCatalogModelPage } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type PublicModelSlugs = {
  segment: string;
  make: string;
  model: string;
};

export async function getPublicModelPage(slugs: PublicModelSlugs) {
  const response = await apiClient.get<ApiSuccessResponse<PublicCatalogModelPage>>(
    endpoints.publicCatalog.model(slugs.segment, slugs.make, slugs.model),
    { skipAuthRefresh: true, skipUnauthorizedHandler: true },
  );
  return response.data;
}

export function usePublicModelPage(slugs: PublicModelSlugs) {
  return useQuery({
    queryKey: queryKeys.publicCatalog.model(slugs.segment, slugs.make, slugs.model),
    queryFn: () => getPublicModelPage(slugs),
    // The catalog changes only when an import run is published.
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

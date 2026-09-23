import { useQuery } from '@tanstack/react-query';
import type { PublicCatalogMakePage } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type PublicMakeSlugs = {
  segment: string;
  make: string;
};

export async function getPublicMakePage(slugs: PublicMakeSlugs) {
  const response = await apiClient.get<ApiSuccessResponse<PublicCatalogMakePage>>(
    endpoints.publicCatalog.make(slugs.segment, slugs.make),
    { skipAuthRefresh: true, skipUnauthorizedHandler: true },
  );
  return response.data;
}

export function usePublicMakePage(slugs: PublicMakeSlugs) {
  return useQuery({
    queryKey: queryKeys.publicCatalog.make(slugs.segment, slugs.make),
    queryFn: () => getPublicMakePage(slugs),
    // The catalog changes only when an import run is published.
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

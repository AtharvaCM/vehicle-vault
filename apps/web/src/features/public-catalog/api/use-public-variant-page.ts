import { useQuery } from '@tanstack/react-query';
import type { PublicCatalogVariantPage } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type PublicVariantSlugs = {
  segment: string;
  make: string;
  model: string;
  generation: string;
  variant: string;
};

export async function getPublicVariantPage(slugs: PublicVariantSlugs) {
  const response = await apiClient.get<ApiSuccessResponse<PublicCatalogVariantPage>>(
    endpoints.publicCatalog.variant(
      slugs.segment,
      slugs.make,
      slugs.model,
      slugs.generation,
      slugs.variant,
    ),
    { skipAuthRefresh: true, skipUnauthorizedHandler: true },
  );
  return response.data;
}

export function usePublicVariantPage(slugs: PublicVariantSlugs) {
  return useQuery({
    queryKey: queryKeys.publicCatalog.variant(
      slugs.segment,
      slugs.make,
      slugs.model,
      slugs.generation,
      slugs.variant,
    ),
    queryFn: () => getPublicVariantPage(slugs),
    // The catalog changes only when an import run is published.
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}

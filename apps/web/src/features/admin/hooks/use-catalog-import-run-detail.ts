import { useQuery } from '@tanstack/react-query';

import { catalogImportRunDetailQueryOptions } from '../api/get-catalog-import-run-detail';

export function useCatalogImportRunDetail(runId: string | null) {
  return useQuery({
    ...catalogImportRunDetailQueryOptions(runId ?? 'missing'),
    enabled: Boolean(runId),
  });
}

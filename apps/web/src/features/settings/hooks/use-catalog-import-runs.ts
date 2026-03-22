import { useQuery } from '@tanstack/react-query';

import { catalogImportRunsQueryOptions } from '../api/get-catalog-import-runs';

export function useCatalogImportRuns() {
  return useQuery(catalogImportRunsQueryOptions());
}

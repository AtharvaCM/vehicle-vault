import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { archiveMissingCatalogImportRun } from '../api/archive-missing-catalog-import-run';

export function useArchiveMissingCatalogImportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveMissingCatalogImportRun,
    onSuccess: async (run) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.importRuns(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.importRunDetail(run.id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.all(),
        }),
      ]);
    },
  });
}

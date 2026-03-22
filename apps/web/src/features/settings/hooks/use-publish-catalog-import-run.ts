import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { publishCatalogImportRun } from '../api/publish-catalog-import-run';

export function usePublishCatalogImportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishCatalogImportRun,
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

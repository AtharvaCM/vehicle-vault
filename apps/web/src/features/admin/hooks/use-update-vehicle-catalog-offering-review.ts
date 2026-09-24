import type { UpdateVehicleCatalogOfferingReviewInput } from '@vehicle-vault/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { updateVehicleCatalogOfferingReview } from '../api/update-vehicle-catalog-offering-review';

type UpdateVehicleCatalogOfferingReviewVariables = {
  input: UpdateVehicleCatalogOfferingReviewInput;
  offeringId: string;
  runId: string;
};

export function useUpdateVehicleCatalogOfferingReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ offeringId, input }: UpdateVehicleCatalogOfferingReviewVariables) =>
      updateVehicleCatalogOfferingReview(offeringId, input),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.importRuns(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.importRunDetail(variables.runId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.vehicleCatalog.all(),
        }),
      ]);
    },
  });
}

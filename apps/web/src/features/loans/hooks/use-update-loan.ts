import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateVehicleLoanInput } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import { updateLoan } from '../api/update-loan';

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVehicleLoanInput }) =>
      updateLoan(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.vehicleLoans.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all() });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FuelLog } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type CreateFuelLogInput = {
  date: string;
  odometer: number;
  quantity: number;
  price: number;
  totalCost: number;
  location?: string;
  notes?: string;
};

export type BulkCreateFuelLogResponse = {
  count: number;
};

export async function createBulkFuelLogs(vehicleId: string, logs: CreateFuelLogInput[]) {
  const response = await apiClient.post<ApiSuccessResponse<BulkCreateFuelLogResponse>, { logs: CreateFuelLogInput[] }>(
    endpoints.fuelLogs.bulk(vehicleId),
    { logs },
  );

  return response.data;
}

export function useBulkCreateFuelLogs(vehicleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (logs: CreateFuelLogInput[]) => createBulkFuelLogs(vehicleId, logs),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.fuelLogs(vehicleId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.summary(),
      });
    },
  });
}

import { queryOptions } from '@tanstack/react-query';
import type {
  ServiceBaseline,
  ServiceBaselineUpsertInput,
  VehicleServiceBaselineCoverage,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getServiceBaselineCoverage(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleServiceBaselineCoverage>>(
    endpoints.serviceBaseline.coverage(vehicleId),
  );

  return response.data;
}

export function serviceBaselineCoverageQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.serviceBaseline.coverage(vehicleId),
    queryFn: () => getServiceBaselineCoverage(vehicleId),
    enabled: vehicleId.length > 0,
  });
}

export async function upsertServiceBaseline(vehicleId: string, body: ServiceBaselineUpsertInput) {
  const response = await apiClient.put<
    ApiSuccessResponse<ServiceBaseline[]>,
    ServiceBaselineUpsertInput
  >(endpoints.serviceBaseline.upsert(vehicleId), body);

  return response.data;
}

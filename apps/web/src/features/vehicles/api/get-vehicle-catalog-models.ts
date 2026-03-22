import { queryOptions } from '@tanstack/react-query';
import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  type VehicleCatalogModelOption,
  type VehicleCatalogModelQuery,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

type GetVehicleCatalogModelsParams = Pick<
  VehicleCatalogModelQuery,
  'make' | 'marketCode' | 'vehicleType' | 'year'
>;

export async function getVehicleCatalogModels({
  make,
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  vehicleType,
  year,
}: GetVehicleCatalogModelsParams) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleCatalogModelOption[]>>(
    endpoints.vehicleCatalog.models,
    {
      query: {
        make,
        marketCode,
        vehicleType,
        year,
      },
    },
  );

  return response.data;
}

export function vehicleCatalogModelsQueryOptions({
  make,
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  vehicleType,
  year,
}: GetVehicleCatalogModelsParams) {
  return queryOptions({
    queryKey: queryKeys.vehicleCatalog.models(marketCode, vehicleType, make, year),
    queryFn: () =>
      getVehicleCatalogModels({
        make,
        marketCode,
        vehicleType,
        year,
      }),
  });
}

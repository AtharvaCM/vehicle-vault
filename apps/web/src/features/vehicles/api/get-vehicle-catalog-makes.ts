import { queryOptions } from '@tanstack/react-query';
import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  type VehicleCatalogMakeOption,
  type VehicleCatalogMakeQuery,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

type GetVehicleCatalogMakesParams = Pick<
  VehicleCatalogMakeQuery,
  'marketCode' | 'vehicleType' | 'year'
>;

export async function getVehicleCatalogMakes({
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  vehicleType,
  year,
}: GetVehicleCatalogMakesParams) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleCatalogMakeOption[]>>(
    endpoints.vehicleCatalog.makes,
    {
      query: {
        marketCode,
        vehicleType,
        year,
      },
    },
  );

  return response.data;
}

export function vehicleCatalogMakesQueryOptions({
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  vehicleType,
  year,
}: GetVehicleCatalogMakesParams) {
  return queryOptions({
    queryKey: queryKeys.vehicleCatalog.makes(marketCode, vehicleType, year),
    queryFn: () =>
      getVehicleCatalogMakes({
        marketCode,
        vehicleType,
        year,
      }),
  });
}

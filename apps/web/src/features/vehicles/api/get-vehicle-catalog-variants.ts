import { queryOptions } from '@tanstack/react-query';
import {
  DEFAULT_VEHICLE_CATALOG_MARKET,
  type VehicleCatalogVariantOption,
  type VehicleCatalogVariantQuery,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

type GetVehicleCatalogVariantsParams = Pick<
  VehicleCatalogVariantQuery,
  'make' | 'marketCode' | 'model' | 'vehicleType' | 'year'
>;

export async function getVehicleCatalogVariants({
  make,
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  model,
  vehicleType,
  year,
}: GetVehicleCatalogVariantsParams) {
  const response = await apiClient.get<ApiSuccessResponse<VehicleCatalogVariantOption[]>>(
    endpoints.vehicleCatalog.variants,
    {
      query: {
        make,
        marketCode,
        model,
        vehicleType,
        year,
      },
    },
  );

  return response.data;
}

export function vehicleCatalogVariantsQueryOptions({
  make,
  marketCode = DEFAULT_VEHICLE_CATALOG_MARKET,
  model,
  vehicleType,
  year,
}: GetVehicleCatalogVariantsParams) {
  return queryOptions({
    queryKey: queryKeys.vehicleCatalog.variants(marketCode, vehicleType, make, model, year),
    queryFn: () =>
      getVehicleCatalogVariants({
        make,
        marketCode,
        model,
        vehicleType,
        year,
      }),
  });
}

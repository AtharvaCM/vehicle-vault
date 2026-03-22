import { useQuery } from '@tanstack/react-query';
import type { VehicleCatalogVariantQuery } from '@vehicle-vault/shared';

import { vehicleCatalogVariantsQueryOptions } from '../api/get-vehicle-catalog-variants';

type UseVehicleCatalogVariantsParams = Pick<
  VehicleCatalogVariantQuery,
  'make' | 'marketCode' | 'model' | 'vehicleType' | 'year'
>;

export function useVehicleCatalogVariants(params: UseVehicleCatalogVariantsParams, enabled = true) {
  return useQuery({
    ...vehicleCatalogVariantsQueryOptions(params),
    enabled,
  });
}

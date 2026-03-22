import { useQuery } from '@tanstack/react-query';
import type { VehicleCatalogModelQuery } from '@vehicle-vault/shared';

import { vehicleCatalogModelsQueryOptions } from '../api/get-vehicle-catalog-models';

type UseVehicleCatalogModelsParams = Pick<
  VehicleCatalogModelQuery,
  'make' | 'marketCode' | 'vehicleType' | 'year'
>;

export function useVehicleCatalogModels(params: UseVehicleCatalogModelsParams, enabled = true) {
  return useQuery({
    ...vehicleCatalogModelsQueryOptions(params),
    enabled,
  });
}

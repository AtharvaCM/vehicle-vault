import { useQuery } from '@tanstack/react-query';
import type { VehicleCatalogMakeQuery } from '@vehicle-vault/shared';

import { vehicleCatalogMakesQueryOptions } from '../api/get-vehicle-catalog-makes';

type UseVehicleCatalogMakesParams = Pick<VehicleCatalogMakeQuery, 'marketCode' | 'vehicleType' | 'year'>;

export function useVehicleCatalogMakes(params: UseVehicleCatalogMakesParams, enabled = true) {
  return useQuery({
    ...vehicleCatalogMakesQueryOptions(params),
    enabled,
  });
}

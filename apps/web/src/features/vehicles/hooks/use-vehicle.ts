import { useQuery } from '@tanstack/react-query';

import { vehicleDetailQueryOptions } from '../api/get-vehicle-by-id';

export function useVehicle(vehicleId: string) {
  return useQuery(vehicleDetailQueryOptions(vehicleId));
}

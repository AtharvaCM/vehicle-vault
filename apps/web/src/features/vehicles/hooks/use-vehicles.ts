import { useQuery } from '@tanstack/react-query';

import { vehiclesListQueryOptions } from '../api/get-vehicles';

export function useVehicles() {
  return useQuery(vehiclesListQueryOptions());
}

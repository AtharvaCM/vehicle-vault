import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/query-keys';

import { getVehicleFuelEconomy } from '../api/get-vehicle-fuel-economy';

export function useVehicleFuelEconomy(vehicleId: string) {
  return useQuery({
    queryKey: queryKeys.vehicles.fuelEconomy(vehicleId),
    queryFn: () => getVehicleFuelEconomy(vehicleId),
  });
}

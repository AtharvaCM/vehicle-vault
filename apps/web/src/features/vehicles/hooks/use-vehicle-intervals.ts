import { useQuery } from '@tanstack/react-query';

import { vehicleIntervalsQueryOptions } from '../api/get-vehicle-intervals';

export function useVehicleIntervals(vehicleId: string) {
  return useQuery(vehicleIntervalsQueryOptions(vehicleId));
}

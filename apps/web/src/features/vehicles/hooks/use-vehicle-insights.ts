import { useQuery } from '@tanstack/react-query';

import { vehicleInsightsQueryOptions } from '../api/get-vehicle-insights';

export function useVehicleInsights(vehicleId: string) {
  return useQuery(vehicleInsightsQueryOptions(vehicleId));
}

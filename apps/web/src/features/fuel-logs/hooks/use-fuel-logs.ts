import { useQuery } from '@tanstack/react-query';

import { fuelLogsQueryOptions } from '../api/get-fuel-logs';

export function useFuelLogs(vehicleId: string) {
  return useQuery(fuelLogsQueryOptions(vehicleId));
}

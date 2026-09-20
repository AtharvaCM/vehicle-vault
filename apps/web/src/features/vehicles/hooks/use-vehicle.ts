import { useQuery } from '@tanstack/react-query';

import { vehicleDetailQueryOptions } from '../api/get-vehicle-by-id';

/**
 * A page that only learns its vehicle from a record it is still loading — a
 * maintenance record or a reminder — passes an empty id until then. Asking for
 * `GET /vehicles/` would only 404, so the query waits instead.
 */
export function useVehicle(vehicleId: string, enabled = true) {
  return useQuery({
    ...vehicleDetailQueryOptions(vehicleId),
    enabled: enabled && vehicleId.length > 0,
  });
}

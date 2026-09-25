import { queryOptions } from '@tanstack/react-query';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';
import { keepSavedPapersFor } from '@/features/vehicle-documents/offline/saved-papers-store';

import type { Vehicle } from '../types/vehicle';

export async function getVehicles() {
  const response = await apiClient.get<ApiSuccessResponse<Vehicle[]>>(endpoints.vehicles.list);
  // Every vehicle the user can see: saved papers of any other are no longer theirs to keep.
  if (Array.isArray(response.data)) {
    void keepSavedPapersFor(response.data.map((vehicle) => vehicle.id));
  }

  return response.data;
}

export function vehiclesListQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.vehicles.list(),
    queryFn: getVehicles,
  });
}

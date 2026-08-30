import { queryOptions } from '@tanstack/react-query';
import type { Accessory, CreateAccessoryInput, UpdateAccessoryInput } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export async function getVehicleAccessories(vehicleId: string) {
  const response = await apiClient.get<ApiSuccessResponse<Accessory[]>>(
    endpoints.accessories.list(vehicleId),
  );

  return response.data;
}

export function vehicleAccessoriesQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.accessories.all(vehicleId),
    queryFn: () => getVehicleAccessories(vehicleId),
    enabled: vehicleId.length > 0,
  });
}

export async function createAccessory(vehicleId: string, body: CreateAccessoryInput) {
  const response = await apiClient.post<ApiSuccessResponse<Accessory>, CreateAccessoryInput>(
    endpoints.accessories.create(vehicleId),
    body,
  );

  return response.data;
}

export async function updateAccessory(accessoryId: string, body: UpdateAccessoryInput) {
  const response = await apiClient.patch<ApiSuccessResponse<Accessory>, UpdateAccessoryInput>(
    endpoints.accessories.update(accessoryId),
    body,
  );

  return response.data;
}

export async function deleteAccessory(accessoryId: string) {
  const response = await apiClient.delete<ApiSuccessResponse<{ id: string }>>(
    endpoints.accessories.remove(accessoryId),
  );

  return response.data;
}

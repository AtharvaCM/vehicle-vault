import { apiClient } from '@/lib/api/api-client';
import {
  type CreateWarrantyInput,
  type UpdateWarrantyInput,
  type Warranty,
} from '@vehicle-vault/shared';

export async function listWarranties(vehicleId: string) {
  return apiClient.get<Warranty[]>(`vehicles/${vehicleId}/warranty`);
}

export async function createWarranty(vehicleId: string, data: CreateWarrantyInput) {
  return apiClient.post<Warranty, CreateWarrantyInput>(
    `vehicles/${vehicleId}/warranty`,
    data,
  );
}

export async function updateWarranty(
  vehicleId: string,
  id: string,
  data: UpdateWarrantyInput,
) {
  return apiClient.patch<Warranty, UpdateWarrantyInput>(
    `vehicles/${vehicleId}/warranty/${id}`,
    data,
  );
}

export async function deleteWarranty(vehicleId: string, id: string) {
  return apiClient.delete(`vehicles/${vehicleId}/warranty/${id}`);
}

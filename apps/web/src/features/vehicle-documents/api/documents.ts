import { apiClient } from '@/lib/api/api-client';
import {
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocument,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

export async function listVehicleDocuments(vehicleId: string, kind?: VehicleDocumentKind) {
  const query = kind ? { kind } : undefined;
  return apiClient.get<VehicleDocument[]>(`vehicles/${vehicleId}/documents`, { query });
}

export async function createVehicleDocument(
  vehicleId: string,
  data: CreateVehicleDocumentInput,
) {
  return apiClient.post<VehicleDocument, CreateVehicleDocumentInput>(
    `vehicles/${vehicleId}/documents`,
    data,
  );
}

export async function updateVehicleDocument(
  vehicleId: string,
  id: string,
  data: UpdateVehicleDocumentInput,
) {
  return apiClient.patch<VehicleDocument, UpdateVehicleDocumentInput>(
    `vehicles/${vehicleId}/documents/${id}`,
    data,
  );
}

export async function deleteVehicleDocument(
  vehicleId: string,
  id: string,
  kind: VehicleDocumentKind,
) {
  return apiClient.delete(`vehicles/${vehicleId}/documents/${kind}/${id}`);
}

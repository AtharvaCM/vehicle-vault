import { apiClient, type ApiSuccessResponse } from '@/lib/api/api-client';
import {
  type CreateVehicleDocumentInput,
  type UpdateVehicleDocumentInput,
  type VehicleDocument,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

export async function listVehicleDocuments(vehicleId: string, kind?: VehicleDocumentKind) {
  const query = kind ? { kind } : undefined;
  const response = await apiClient.get<ApiSuccessResponse<VehicleDocument[]>>(
    `vehicles/${vehicleId}/documents`,
    { query },
  );
  return response.data;
}

export async function createVehicleDocument(
  vehicleId: string,
  data: CreateVehicleDocumentInput,
) {
  const response = await apiClient.post<
    ApiSuccessResponse<VehicleDocument>,
    CreateVehicleDocumentInput
  >(`vehicles/${vehicleId}/documents`, data);
  return response.data;
}

export async function updateVehicleDocument(
  vehicleId: string,
  id: string,
  data: UpdateVehicleDocumentInput,
) {
  const response = await apiClient.patch<
    ApiSuccessResponse<VehicleDocument>,
    UpdateVehicleDocumentInput
  >(`vehicles/${vehicleId}/documents/${id}`, data);
  return response.data;
}

export async function deleteVehicleDocument(
  vehicleId: string,
  id: string,
  kind: VehicleDocumentKind,
) {
  return apiClient.delete<ApiSuccessResponse<{ removed: boolean }>>(
    `vehicles/${vehicleId}/documents/${kind}/${id}`,
  );
}

import { apiClient } from '@/lib/api/api-client';
import {
  type CreateInsurancePolicyInput,
  type InsurancePolicy,
  type UpdateInsurancePolicyInput,
} from '@vehicle-vault/shared';

export async function listInsurancePolicies(vehicleId: string) {
  return apiClient.get<InsurancePolicy[]>(`vehicles/${vehicleId}/insurance`);
}

export async function createInsurancePolicy(vehicleId: string, data: CreateInsurancePolicyInput) {
  return apiClient.post<InsurancePolicy, CreateInsurancePolicyInput>(
    `vehicles/${vehicleId}/insurance`,
    data,
  );
}

export async function updateInsurancePolicy(
  vehicleId: string,
  id: string,
  data: UpdateInsurancePolicyInput,
) {
  return apiClient.patch<InsurancePolicy, UpdateInsurancePolicyInput>(
    `vehicles/${vehicleId}/insurance/${id}`,
    data,
  );
}

export async function deleteInsurancePolicy(vehicleId: string, id: string) {
  return apiClient.delete(`vehicles/${vehicleId}/insurance/${id}`);
}

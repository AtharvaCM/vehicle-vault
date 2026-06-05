import { queryOptions } from '@tanstack/react-query';
import type { VehicleInvite, VehicleMember, VehicleRole } from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

export type InviteCreateResponse = {
  invite: VehicleInvite;
  token?: string;
};

export async function listMembers(vehicleId: string): Promise<VehicleMember[]> {
  const res = await apiClient.get<ApiSuccessResponse<VehicleMember[]>>(
    endpoints.vehicleSharing.members(vehicleId),
  );
  return res.data;
}

export function membersQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleSharing.members(vehicleId),
    queryFn: () => listMembers(vehicleId),
  });
}

export async function listInvites(vehicleId: string): Promise<VehicleInvite[]> {
  const res = await apiClient.get<ApiSuccessResponse<VehicleInvite[]>>(
    endpoints.vehicleSharing.invites(vehicleId),
  );
  return res.data;
}

export function invitesQueryOptions(vehicleId: string) {
  return queryOptions({
    queryKey: queryKeys.vehicleSharing.invites(vehicleId),
    queryFn: () => listInvites(vehicleId),
  });
}

export async function createInvite(
  vehicleId: string,
  body: { email: string; role: Exclude<VehicleRole, 'owner'> },
): Promise<InviteCreateResponse> {
  return apiClient.post<InviteCreateResponse, typeof body>(
    endpoints.vehicleSharing.invites(vehicleId),
    body,
  );
}

export async function revokeInvite(vehicleId: string, inviteId: string): Promise<void> {
  await apiClient.delete<void>(endpoints.vehicleSharing.invite(vehicleId, inviteId));
}

export async function updateMemberRole(
  vehicleId: string,
  memberId: string,
  body: { role: Exclude<VehicleRole, 'owner'> },
): Promise<VehicleMember> {
  return apiClient.patch<VehicleMember, typeof body>(
    endpoints.vehicleSharing.member(vehicleId, memberId),
    body,
  );
}

export async function removeMember(vehicleId: string, memberId: string): Promise<void> {
  await apiClient.delete<void>(endpoints.vehicleSharing.member(vehicleId, memberId));
}

export async function transferOwnership(
  vehicleId: string,
  memberId: string,
): Promise<void> {
  await apiClient.post<void, { memberId: string }>(
    endpoints.vehicleSharing.transferOwnership(vehicleId),
    { memberId },
  );
}

export async function acceptInvite(token: string): Promise<{ vehicleId: string; role: VehicleRole }> {
  return apiClient.post<{ vehicleId: string; role: VehicleRole }, { token: string }>(
    endpoints.vehicleSharing.accept(),
    { token },
  );
}

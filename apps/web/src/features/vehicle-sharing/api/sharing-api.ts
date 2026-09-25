import { queryOptions } from '@tanstack/react-query';
import type {
  VehicleInvite,
  VehicleInviteCreated,
  VehicleInvitePreview,
  VehicleMember,
  VehicleRole,
} from '@vehicle-vault/shared';

import type { ApiSuccessResponse } from '@/lib/api/api-client';
import { apiClient } from '@/lib/api/api-client';
import { endpoints } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/query-keys';

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
): Promise<VehicleInviteCreated> {
  const res = await apiClient.post<ApiSuccessResponse<VehicleInviteCreated>, typeof body>(
    endpoints.vehicleSharing.invites(vehicleId),
    body,
  );
  return res.data;
}

export async function revokeInvite(vehicleId: string, inviteId: string): Promise<void> {
  await apiClient.delete<void>(endpoints.vehicleSharing.invite(vehicleId, inviteId));
}

/** A fresh link for a pending invite: the old one stops working the moment this one is issued. */
export async function resendInvite(
  vehicleId: string,
  inviteId: string,
): Promise<VehicleInviteCreated> {
  const res = await apiClient.post<ApiSuccessResponse<VehicleInviteCreated>, undefined>(
    endpoints.vehicleSharing.resendInvite(vehicleId, inviteId),
  );
  return res.data;
}

export async function updateMemberRole(
  vehicleId: string,
  memberId: string,
  body: { role: Exclude<VehicleRole, 'owner'> },
): Promise<VehicleMember> {
  const res = await apiClient.patch<ApiSuccessResponse<VehicleMember>, typeof body>(
    endpoints.vehicleSharing.member(vehicleId, memberId),
    body,
  );
  return res.data;
}

export async function removeMember(vehicleId: string, memberId: string): Promise<void> {
  await apiClient.delete<void>(endpoints.vehicleSharing.member(vehicleId, memberId));
}

export async function transferOwnership(vehicleId: string, memberId: string): Promise<void> {
  await apiClient.post<void, { memberId: string }>(
    endpoints.vehicleSharing.transferOwnership(vehicleId),
    { memberId },
  );
}

// The API wraps every answer in `{ success, data }`; these used to return the
// wrapper itself, so an accepted invite navigated to `/vehicles/undefined`.
export async function acceptInvite(
  token: string,
): Promise<{ vehicleId: string; role: VehicleRole }> {
  const res = await apiClient.post<
    ApiSuccessResponse<{ vehicleId: string; role: VehicleRole }>,
    { token: string }
  >(endpoints.vehicleSharing.accept(), { token });
  return res.data;
}

export async function declineInvite(token: string): Promise<void> {
  await apiClient.post<ApiSuccessResponse<{ declined: true }>, { token: string }>(
    endpoints.vehicleSharing.decline(),
    { token },
  );
}

/**
 * The invite behind a link. Signed in, it also says whether the invite is
 * addressed to this account. An unknown link is the API's 404, never a reason
 * to touch the session.
 */
export async function previewInvite(
  token: string,
  signedIn: boolean,
): Promise<VehicleInvitePreview> {
  const res = await apiClient.post<ApiSuccessResponse<VehicleInvitePreview>, { token: string }>(
    signedIn ? endpoints.vehicleSharing.previewMine() : endpoints.vehicleSharing.preview(),
    { token },
    { skipAuthRefresh: !signedIn, skipUnauthorizedHandler: !signedIn },
  );
  return res.data;
}

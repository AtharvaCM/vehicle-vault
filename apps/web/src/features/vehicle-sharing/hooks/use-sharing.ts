import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VehicleRole } from '@vehicle-vault/shared';

import { queryKeys } from '@/lib/query/query-keys';

import {
  acceptInvite,
  createInvite,
  invitesQueryOptions,
  membersQueryOptions,
  removeMember,
  revokeInvite,
  transferOwnership,
  updateMemberRole,
} from '../api/sharing-api';

export function useMembers(vehicleId: string) {
  return useQuery(membersQueryOptions(vehicleId));
}

/** Returns the current user's role on this vehicle, derived from the members list. */
export function useCurrentUserRole(vehicleId: string) {
  const query = useMembers(vehicleId);
  const self = query.data?.find((m) => m.isSelf);
  return { role: self?.role ?? null, isLoading: query.isLoading };
}

export function useInvites(vehicleId: string, enabled = true) {
  return useQuery({ ...invitesQueryOptions(vehicleId), enabled });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, vehicleId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.vehicleSharing.members(vehicleId) });
  qc.invalidateQueries({ queryKey: queryKeys.vehicleSharing.invites(vehicleId) });
  qc.invalidateQueries({ queryKey: queryKeys.vehicles.detail(vehicleId) });
  qc.invalidateQueries({ queryKey: queryKeys.vehicles.list() });
}

export function useCreateInvite(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: Exclude<VehicleRole, 'owner'> }) =>
      createInvite(vehicleId, body),
    onSuccess: () => invalidate(qc, vehicleId),
  });
}

export function useRevokeInvite(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(vehicleId, inviteId),
    onSuccess: () => invalidate(qc, vehicleId),
  });
}

export function useUpdateMemberRole(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { memberId: string; role: Exclude<VehicleRole, 'owner'> }) =>
      updateMemberRole(vehicleId, vars.memberId, { role: vars.role }),
    onSuccess: () => invalidate(qc, vehicleId),
  });
}

export function useRemoveMember(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => removeMember(vehicleId, memberId),
    onSuccess: () => invalidate(qc, vehicleId),
  });
}

export function useTransferOwnership(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => transferOwnership(vehicleId, memberId),
    onSuccess: () => invalidate(qc, vehicleId),
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vehicles.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
}

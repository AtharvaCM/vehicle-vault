import { useState } from 'react';
import { Crown, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import type { VehicleMember, VehicleRole } from '@vehicle-vault/shared';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils/format-date';

import {
  useCreateInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useRevokeInvite,
  useTransferOwnership,
  useUpdateMemberRole,
} from '../hooks/use-sharing';

type Props = {
  vehicleId: string;
  currentUserRole: VehicleRole | null;
};

type EditableRole = Exclude<VehicleRole, 'owner'>;

export function MembersTab({ vehicleId, currentUserRole }: Props) {
  const isOwner = currentUserRole === 'owner';
  const membersQuery = useMembers(vehicleId);
  const invitesQuery = useInvites(vehicleId, isOwner);

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (membersQuery.isError) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="p-6 text-sm text-rose-800">
          Failed to load members: {getApiErrorMessage(membersQuery.error)}
        </CardContent>
      </Card>
    );
  }

  const members = membersQuery.data ?? [];
  const invites = invitesQuery.data ?? [];
  const pendingInvites = invites.filter((inv) => inv.status === 'pending');

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Members</CardTitle>
          <CardDescription>
            People with access to this vehicle. Owners can change roles and invite collaborators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              vehicleId={vehicleId}
              canManage={isOwner}
              isSelf={member.isSelf}
            />
          ))}
          {members.length === 0 ? (
            <p className="text-sm text-slate-500">No members yet.</p>
          ) : null}
        </CardContent>
      </Card>

      {isOwner ? (
        <>
          <InviteForm vehicleId={vehicleId} />
          {pendingInvites.length > 0 ? (
            <PendingInvitesCard vehicleId={vehicleId} invites={pendingInvites} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MemberRow({
  member,
  vehicleId,
  canManage,
  isSelf,
}: {
  member: VehicleMember;
  vehicleId: string;
  canManage: boolean;
  isSelf: boolean;
}) {
  const updateRoleMutation = useUpdateMemberRole(vehicleId);
  const removeMutation = useRemoveMember(vehicleId);
  const transferMutation = useTransferOwnership(vehicleId);

  const isOwnerRow = member.role === 'owner';

  function handleRoleChange(role: EditableRole) {
    updateRoleMutation.mutate(
      { memberId: member.id, role },
      {
        onSuccess: () => appToast.success({ title: 'Role updated' }),
        onError: (error) =>
          appToast.error({ title: 'Role update failed', description: getApiErrorMessage(error) }),
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-slate-100 p-2 text-slate-500">
          {isOwnerRow ? <Crown className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {member.name}
            {isSelf ? <span className="ml-2 text-xs text-slate-400">(you)</span> : null}
          </p>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <RoleBadge role={member.role} />
        {canManage && !isOwnerRow ? (
          <>
            <Select
              value={member.role}
              onValueChange={(value) => handleRoleChange(value as EditableRole)}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <ConfirmActionDialog
              title="Promote to owner?"
              description={`Transfer ownership of this vehicle to ${member.name}? You will become an editor and can no longer invite or remove members.`}
              triggerLabel="Promote"
              triggerVariant="ghost"
              triggerIcon={<Crown className="mr-1 h-4 w-4" />}
              confirmLabel="Transfer ownership"
              isPending={transferMutation.isPending}
              onConfirm={() =>
                transferMutation.mutateAsync(member.id).then(
                  () => appToast.success({ title: 'Ownership transferred' }),
                  (error) =>
                    appToast.error({
                      title: 'Transfer failed',
                      description: getApiErrorMessage(error),
                    }),
                )
              }
            />
            <ConfirmActionDialog
              title="Remove member?"
              description={`Remove ${member.name} from this vehicle? They will lose access immediately.`}
              triggerLabel="Remove"
              triggerVariant="ghost"
              triggerIcon={<Trash2 className="mr-1 h-4 w-4" />}
              confirmLabel="Remove"
              isPending={removeMutation.isPending}
              onConfirm={() =>
                removeMutation.mutateAsync(member.id).then(
                  () => appToast.success({ title: 'Member removed' }),
                  (error) =>
                    appToast.error({
                      title: 'Remove failed',
                      description: getApiErrorMessage(error),
                    }),
                )
              }
            />
          </>
        ) : null}
        {isSelf && !isOwnerRow && !canManage ? (
          <ConfirmActionDialog
            title="Leave this vehicle?"
            description="You will lose access to this vehicle. The owner can invite you again later."
            triggerLabel="Leave"
            triggerVariant="ghost"
            confirmLabel="Leave"
            isPending={removeMutation.isPending}
            onConfirm={() =>
              removeMutation.mutateAsync(member.id).then(
                () => appToast.success({ title: 'You left this vehicle' }),
                (error) =>
                  appToast.error({
                    title: 'Leave failed',
                    description: getApiErrorMessage(error),
                  }),
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: VehicleRole }) {
  if (role === 'owner') return <Badge className="bg-amber-100 text-amber-800">Owner</Badge>;
  if (role === 'editor') return <Badge className="bg-blue-100 text-blue-800">Editor</Badge>;
  return <Badge className="bg-slate-100 text-slate-700">Viewer</Badge>;
}

function InviteForm({ vehicleId }: { vehicleId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('editor');
  const mutation = useCreateInvite(vehicleId);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (result) => {
          setEmail('');
          appToast.success({
            title: 'Invitation sent',
            description: result.token
              ? `Dev token: ${result.token.slice(0, 12)}…`
              : `An email was sent to ${result.invite.email}.`,
          });
        },
        onError: (error) =>
          appToast.error({ title: 'Invite failed', description: getApiErrorMessage(error) }),
      },
    );
  }

  return (
    <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-bold">
          <UserPlus className="h-5 w-5" /> Invite a collaborator
        </CardTitle>
        <CardDescription>
          They will receive an email with a link to accept. Invitations expire in 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={handleSubmit}>
          <div className="grid gap-1">
            <Label htmlFor="invite-email" className="text-xs">
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="invite-role" className="text-xs">
              Role
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as EditableRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PendingInvitesCard({
  vehicleId,
  invites,
}: {
  vehicleId: string;
  invites: Array<{ id: string; email: string; role: VehicleRole; expiresAt: string }>;
}) {
  const revokeMutation = useRevokeInvite(vehicleId);

  return (
    <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Pending invitations</CardTitle>
        <CardDescription>Invites that have not been accepted yet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-100 p-2 text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{invite.email}</p>
                <p className="text-xs text-slate-500">
                  Role: {invite.role} · expires {formatDate(invite.expiresAt)}
                </p>
              </div>
            </div>
            <ConfirmActionDialog
              title="Revoke invitation?"
              description={`Revoke the invitation sent to ${invite.email}? The link will stop working.`}
              triggerLabel="Revoke"
              triggerVariant="ghost"
              confirmLabel="Revoke"
              isPending={revokeMutation.isPending}
              onConfirm={() =>
                revokeMutation.mutateAsync(invite.id).then(
                  () => appToast.success({ title: 'Invitation revoked' }),
                  (error) =>
                    appToast.error({
                      title: 'Revoke failed',
                      description: getApiErrorMessage(error),
                    }),
                )
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}


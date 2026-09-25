import { useState } from 'react';
import {
  Copy,
  Crown,
  Mail,
  MessageCircle,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  VehicleInvite,
  VehicleInviteCreated,
  VehicleMember,
  VehicleRole,
} from '@vehicle-vault/shared';

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
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import {
  useCreateInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useResendInvite,
  useRevokeInvite,
  useTransferOwnership,
  useUpdateMemberRole,
} from '../hooks/use-sharing';
import { EDITABLE_ROLES, type EditableRole, ROLE_COPY } from '../lib/role-copy';

type Props = {
  vehicleId: string;
  currentUserRole: VehicleRole | null;
};

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
      <Card className="border-late/30 bg-late-tint">
        <CardContent className="p-6 text-ui text-late">
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
      <Card className="border-line/60 bg-surface/70">
        <CardHeader>
          <CardTitle className="text-lead font-bold">Members</CardTitle>
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
          {members.length === 0 ? <p className="text-ui text-fg-3">No members yet.</p> : null}
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-page p-2 text-fg-3">
          {isOwnerRow ? <Crown className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-ui font-semibold">
            {member.name}
            {isSelf ? <span className="ml-2 text-caption text-fg-3">(you)</span> : null}
          </p>
          <p className="break-all text-caption text-fg-3">{member.email}</p>
          <p className="text-caption text-fg-3">{ROLE_COPY[member.role].detail}</p>
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
                {EDITABLE_ROLES.map((editableRole) => (
                  <SelectItem key={editableRole} value={editableRole}>
                    {ROLE_COPY[editableRole].label}
                  </SelectItem>
                ))}
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
  if (role === 'owner') {
    return (
      <Badge className="bg-soon-tint text-soon">{format.enumLabel('vehicleRole', role)}</Badge>
    );
  }
  if (role === 'editor') {
    return (
      <Badge className="bg-brand-tint text-brand">{format.enumLabel('vehicleRole', role)}</Badge>
    );
  }
  return <Badge className="bg-page text-fg-2">{format.enumLabel('vehicleRole', role)}</Badge>;
}

function InviteForm({ vehicleId }: { vehicleId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<EditableRole>('editor');
  const [created, setCreated] = useState<VehicleInviteCreated | null>(null);
  const mutation = useCreateInvite(vehicleId);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(
      { email: email.trim(), role },
      {
        // The link is always handed over: email may not be configured, and
        // even when it is, most families share on WhatsApp.
        onSuccess: (result) => {
          setEmail('');
          setCreated(result);
        },
        onError: (error) =>
          appToast.error({ title: 'Invite failed', description: getApiErrorMessage(error) }),
      },
    );
  }

  return (
    <Card className="border-line/60 bg-surface/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lead font-bold">
          <UserPlus className="h-5 w-5" /> Invite a collaborator
        </CardTitle>
        <CardDescription>
          You’ll get a link to send them. Invitations expire in 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {created ? <InviteLinkPanel created={created} onDone={() => setCreated(null)} /> : null}
        <dl className="grid gap-1 text-caption text-fg-3">
          {EDITABLE_ROLES.map((editableRole) => (
            <div key={editableRole}>
              <dt className="inline font-semibold text-fg-2">{ROLE_COPY[editableRole].label}</dt>{' '}
              <dd className="inline">— {ROLE_COPY[editableRole].detail}</dd>
            </div>
          ))}
          <div>
            <dt className="inline font-semibold text-fg-2">Only you</dt>{' '}
            <dd className="inline">
              — can invite people, change roles, remove members or transfer ownership.
            </dd>
          </div>
        </dl>
        <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto]" onSubmit={handleSubmit}>
          <div className="grid gap-1">
            <Label htmlFor="invite-email" className="text-caption">
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
            <Label htmlFor="invite-role" className="text-caption">
              Role
            </Label>
            <Select value={role} onValueChange={(value) => setRole(value as EditableRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_ROLES.map((editableRole) => (
                  <SelectItem key={editableRole} value={editableRole}>
                    {ROLE_COPY[editableRole].label}
                  </SelectItem>
                ))}
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

/**
 * The invite link, right after creating it. The primary way to hand it over
 * is the device's share sheet where it exists, then WhatsApp, then copying it
 * by hand — most families forward the link themselves. Says an email went
 * out only when the API's `emailSent` says one did.
 */
export function InviteLinkPanel({
  created,
  onDone,
}: {
  created: VehicleInviteCreated;
  onDone: () => void;
}) {
  const { acceptUrl, emailSent, invite } = created;
  const message = `Join my vehicle on Vehicle Vault: ${acceptUrl}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      appToast.success({ title: 'Invite link copied' });
    } catch {
      appToast.error({
        title: 'Couldn’t copy the link',
        description: 'Select it and copy it by hand.',
      });
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-ok/30 bg-ok-tint p-4 text-ui" role="status">
      <p className="font-semibold text-ok">
        {emailSent
          ? `Email sent to ${invite.email}. You can also send them this link.`
          : `Send this link to ${invite.email}. Email isn’t set up, so nothing was sent.`}
      </p>
      <Input
        aria-label="Invite link"
        readOnly
        value={acceptUrl}
        onFocus={(e) => e.target.select()}
      />
      <div className="flex flex-wrap gap-2">
        {canShare ? (
          <Button
            onClick={() =>
              void navigator
                .share({ title: 'Vehicle Vault invite', text: message, url: acceptUrl })
                .catch(() => undefined)
            }
            size="sm"
            type="button"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" /> Share
          </Button>
        ) : null}
        <Button asChild size="sm" variant={canShare ? 'outline' : 'default'}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            rel="noreferrer"
            target="_blank"
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
        <Button onClick={() => void copyLink()} size="sm" type="button" variant="outline">
          <Copy aria-hidden="true" className="h-4 w-4" /> Copy link
        </Button>
        <Button onClick={onDone} size="sm" type="button" variant="ghost">
          Done
        </Button>
      </div>
    </div>
  );
}

function PendingInvitesCard({
  vehicleId,
  invites,
}: {
  vehicleId: string;
  invites: VehicleInvite[];
}) {
  const revokeMutation = useRevokeInvite(vehicleId);
  const resendMutation = useResendInvite(vehicleId);

  // The token is only ever known at creation, so getting the link again means
  // asking the API to rotate it — the previous link stops working the moment
  // this one is issued.
  async function copyAgain(invite: VehicleInvite) {
    try {
      const result = await resendMutation.mutateAsync(invite.id);
      await navigator.clipboard.writeText(result.acceptUrl);
      appToast.success({
        title: 'Invite link copied',
        description: result.emailSent
          ? `Also emailed to ${invite.email}. The previous link no longer works.`
          : 'The previous link no longer works.',
      });
    } catch (error) {
      appToast.error({ title: 'Couldn’t copy the link', description: getApiErrorMessage(error) });
    }
  }

  return (
    <Card className="border-line/60 bg-surface/70">
      <CardHeader>
        <CardTitle className="text-lead font-bold">Pending invitations</CardTitle>
        <CardDescription>Invites that have not been accepted yet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-page p-2 text-fg-3">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <p className="break-all text-ui font-semibold">{invite.email}</p>
                <p className="text-caption text-fg-3">
                  {format.enumLabel('vehicleRole', invite.role)} · invited{' '}
                  {format.date(invite.createdAt)} · expires {format.date(invite.expiresAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                disabled={resendMutation.isPending}
                onClick={() => void copyAgain(invite)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Copy aria-hidden="true" className="mr-1 h-4 w-4" /> Copy link
              </Button>
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

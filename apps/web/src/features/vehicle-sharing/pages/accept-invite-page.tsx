import { Link, useNavigate } from '@tanstack/react-router';
import type { VehicleInvitePreview, VehicleRole } from '@vehicle-vault/shared';
import { Loader2 } from 'lucide-react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/ui/button';
import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ApiError } from '@/lib/api/api-error';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { appToast } from '@/lib/toast';

import { useAcceptInvite, useDeclineInvite, useInvitePreview } from '../hooks/use-sharing';

type Props = { token: string };

/** What each role can do, in the words the invitee decides on. */
const ROLE_WORDS: Record<Exclude<VehicleRole, 'owner'>, { title: string; detail: string }> = {
  editor: {
    title: 'can edit',
    detail: 'Log services, fuel and documents. You can’t delete the vehicle or see its loans.',
  },
  viewer: {
    title: 'can view',
    detail: 'See everything except loans, and show papers at a checkpoint.',
  },
};

function roleWords(role: VehicleRole) {
  return role === 'owner'
    ? { title: 'owns', detail: 'Full control of the vehicle.' }
    : ROLE_WORDS[role];
}

const ENDED: Record<Exclude<VehicleInvitePreview['status'], 'pending'>, string> = {
  accepted: 'This invite has already been accepted',
  declined: 'This invite was declined',
  revoked: 'This invite was cancelled',
  expired: 'This invite has expired',
};

/**
 * An invite link, opened by anyone. It shows what the invite is (vehicle,
 * inviter, role in plain words, the invited address masked, expiry) and never
 * accepts on its own: signed out, it offers sign-in or registration and comes
 * back here through `next`; signed in to the invited account, Accept and
 * Decline; signed in to another account, says so and offers to switch.
 */
export function AcceptInvitePage({ token }: Props) {
  const auth = useAuth();
  const navigate = useNavigate();
  const preview = useInvitePreview(token, auth.isAuthenticated);
  const acceptMutation = useAcceptInvite();
  const declineMutation = useDeclineInvite();
  const returnHere = `/vehicle-invites/${token}`;

  const back = auth.isAuthenticated ? (
    <p>
      Back to{' '}
      <Link className="font-semibold text-fg hover:text-fg-2" to="/dashboard">
        your garage
      </Link>
    </p>
  ) : (
    <p>
      New to Vehicle Vault?{' '}
      <Link className="font-semibold text-fg hover:text-fg-2" to="/">
        See what it does
      </Link>
    </p>
  );

  if (preview.isPending) {
    return (
      <AuthPageShell
        alternateAction={back}
        description="Loading the invitation."
        title="Checking your invite…"
      >
        <div aria-live="polite" className="flex justify-center py-8">
          <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-fg" />
        </div>
      </AuthPageShell>
    );
  }

  if (preview.isError) {
    const notFound = preview.error instanceof ApiError && preview.error.status === 404;
    return (
      <AuthPageShell
        alternateAction={back}
        description={
          notFound
            ? 'The link may be mistyped or incomplete. Ask the owner to send it again.'
            : 'Something went wrong on our side or with the connection.'
        }
        title={notFound ? 'We couldn’t find this invite' : 'We couldn’t load this invite'}
      >
        {notFound ? null : (
          <Button className="w-full" onClick={() => void preview.refetch()}>
            Try again
          </Button>
        )}
      </AuthPageShell>
    );
  }

  const invite = preview.data;
  const role = roleWords(invite.role);
  const summary = `${invite.inviterName} invited ${invite.emailMasked} to ${invite.vehicleLabel}. They ${role.title}.`;

  if (invite.status !== 'pending') {
    return (
      <AuthPageShell
        alternateAction={back}
        description={
          invite.status === 'accepted'
            ? 'If you accepted it, the vehicle is in your garage.'
            : `Ask ${invite.inviterName} for a new invite if you still need access.`
        }
        title={ENDED[invite.status]}
      >
        {auth.isAuthenticated ? (
          <Button asChild className="w-full">
            <Link to="/vehicles">Your vehicles</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link search={{ next: '/vehicles' }} to="/login">
              Sign in
            </Link>
          </Button>
        )}
      </AuthPageShell>
    );
  }

  const details = (
    <dl className="grid gap-3 rounded-2xl border border-line bg-page p-4 text-sm">
      <div>
        <dt className="text-fg-3">Vehicle</dt>
        <dd className="font-semibold text-fg">{invite.vehicleLabel}</dd>
      </div>
      <div>
        <dt className="text-fg-3">From</dt>
        <dd className="text-fg">{invite.inviterName}</dd>
      </div>
      <div>
        <dt className="text-fg-3">You {role.title}</dt>
        <dd className="text-fg">{role.detail}</dd>
      </div>
      <div>
        <dt className="text-fg-3">Invited address</dt>
        <dd className="text-fg">{invite.emailMasked}</dd>
      </div>
      <div>
        <dt className="text-fg-3">Expires</dt>
        <dd className="text-fg">{format.date(invite.expiresAt)}</dd>
      </div>
    </dl>
  );

  if (!auth.isAuthenticated) {
    return (
      <AuthPageShell
        alternateAction={back}
        description={`${summary} Sign in or create an account with ${invite.emailMasked} to accept.`}
        title={`Join ${invite.vehicleLabel}`}
      >
        <div className="space-y-4">
          {details}
          <Button asChild className="w-full">
            <Link search={{ next: returnHere }} to="/login">
              Sign in to accept
            </Link>
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link search={{ next: returnHere }} to="/register">
              Create account to accept
            </Link>
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  if (invite.addressedToYou === false) {
    return (
      <AuthPageShell
        alternateAction={back}
        description={`This invite is for ${invite.emailMasked}. You’re signed in as ${auth.user?.email ?? 'another account'}. Sign out and sign in with the invited address to accept it.`}
        title="This invite is for another account"
      >
        <div className="space-y-4">
          {details}
          <Button
            className="w-full"
            onClick={async () => {
              // Rendered now, so the router's auth context is signed out
              // before /login checks it (it sends signed-in visitors on).
              flushSync(() => auth.logout());
              await navigate({ to: '/login', search: { next: returnHere } });
            }}
          >
            Sign out and switch account
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  const busy = acceptMutation.isPending || declineMutation.isPending;
  const actionError = acceptMutation.error ?? declineMutation.error;

  return (
    <AuthPageShell
      alternateAction={back}
      description={summary}
      title={`Join ${invite.vehicleLabel}`}
    >
      <div className="space-y-4">
        {details}
        {actionError ? (
          <p className="text-sm text-late" role="alert">
            {getApiErrorMessage(actionError, 'That didn’t work. Try again.')}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            acceptMutation.mutate(token, {
              onSuccess: (result) => {
                appToast.success({
                  title: 'Invitation accepted',
                  description: `${invite.vehicleLabel} is in your garage. You ${role.title}.`,
                });
                void navigate({
                  to: '/vehicles/$vehicleId',
                  params: { vehicleId: result.vehicleId },
                });
              },
            })
          }
        >
          {acceptMutation.isPending ? 'Accepting…' : 'Accept invitation'}
        </Button>
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            declineMutation.mutate(token, {
              onSuccess: () => void preview.refetch(),
            })
          }
          variant="outline"
        >
          {declineMutation.isPending ? 'Declining…' : 'Decline'}
        </Button>
      </div>
    </AuthPageShell>
  );
}

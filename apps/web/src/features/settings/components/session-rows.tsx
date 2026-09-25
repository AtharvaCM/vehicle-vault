import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceStrict } from 'date-fns';
import { LogOut, Monitor, Smartphone } from 'lucide-react';
import type { AuthSession } from '@vehicle-vault/shared';

import { confirm } from '@/components/shared/confirm';
import { InlineError } from '@/components/shared/inline-error';
import { StatusPill } from '@/components/shared/status-pill';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { revokeOtherSessions, revokeSession, sessionsQueryOptions } from '../api/sessions';
import { SettingsRow } from './settings-layout';

/** Seen within this long reads "Active now" rather than a count of minutes. */
const ACTIVE_NOW_MS = 5 * 60 * 1000;

const PHONE = /iPhone|Android|iPad/;

function deviceName(session: AuthSession) {
  // A session carried over from before devices were recorded.
  return session.device ?? 'A device signed in earlier';
}

/** "Pune, Maharashtra, India · Active 3 hours ago". */
export function describeSession(session: AuthSession, now: Date = new Date()) {
  const since = now.getTime() - new Date(session.lastActiveAt).getTime();
  const active =
    since < ACTIVE_NOW_MS
      ? 'Active now'
      : `Active ${formatDistanceStrict(new Date(session.lastActiveAt), now, { addSuffix: true })}`;

  return [session.location, active].filter(Boolean).join(' · ');
}

/**
 * Settings → Security's signed-in devices: one row each, this device first
 * and marked, the others with Sign out; then "Sign out other devices" while
 * there are any. A device signed out here lands on sign-in at its next refresh.
 */
export function SessionRows() {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery(sessionsQueryOptions());
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: sessionsQueryOptions().queryKey });

  const revokeOne = useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSettled: refresh,
  });
  const revokeOthers = useMutation({ mutationFn: revokeOtherSessions, onSettled: refresh });

  if (sessionsQuery.isPending) {
    return <SettingsRow label="Signed-in devices" value="Loading…" />;
  }

  if (sessionsQuery.isError) {
    return (
      <SettingsRow
        action={
          <Button onClick={() => void sessionsQuery.refetch()} size="sm" variant="ghost">
            Try again
          </Button>
        }
        label="Signed-in devices"
        value="We couldn't load where you're signed in."
      />
    );
  }

  // This device first, then the most recently active (the API's order).
  const sessions = [...sessionsQuery.data].sort((a, b) => Number(b.current) - Number(a.current));
  const others = sessions.filter((session) => !session.current);
  const error = revokeOne.error ?? revokeOthers.error;

  async function signOut(session: AuthSession) {
    const confirmed = await confirm({
      title: `Sign out ${deviceName(session)}?`,
      description: 'It will need your password, or Google or GitHub, to sign in again.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await revokeOne.mutateAsync(session.id);
      appToast.success({
        title: 'Signed out',
        description: `${deviceName(session)} is signed out.`,
      });
    } catch {
      // Shown under the rows.
    }
  }

  async function signOutOthers() {
    const confirmed = await confirm({
      title: `Sign out ${others.length === 1 ? 'the other device' : `the other ${others.length} devices`}?`,
      description: 'This device stays signed in.',
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const { revoked } = await revokeOthers.mutateAsync();
      appToast.success({
        title: 'Signed out',
        description: `${revoked} other device${revoked === 1 ? ' is' : 's are'} signed out.`,
      });
    } catch {
      // Shown under the rows.
    }
  }

  return (
    <>
      {sessions.map((session) => {
        const Icon = PHONE.test(session.device ?? '') ? Smartphone : Monitor;

        return (
          <div
            data-current={session.current || undefined}
            data-testid="session-row"
            key={session.id}
          >
            <SettingsRow
              action={
                session.current ? null : (
                  <Button
                    aria-label={`Sign out ${deviceName(session)}`}
                    disabled={revokeOne.isPending && revokeOne.variables === session.id}
                    onClick={() => void signOut(session)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Sign out
                  </Button>
                )
              }
              label={
                <span className="inline-flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-4 text-fg-3" />
                  {deviceName(session)}
                  {session.current ? <StatusPill status="ok">This device</StatusPill> : null}
                </span>
              }
              value={describeSession(session)}
            />
          </div>
        );
      })}
      {others.length > 0 ? (
        <SettingsRow
          action={
            <Button
              disabled={revokeOthers.isPending}
              onClick={() => void signOutOthers()}
              size="sm"
              type="button"
              variant="outline"
            >
              <LogOut aria-hidden="true" />
              Sign out other devices
            </Button>
          }
          label="Other devices"
          value={`${others.length} other device${others.length === 1 ? '' : 's'} signed in`}
        />
      ) : null}
      {error ? (
        <div className="px-5 py-3">
          <InlineError message={getApiErrorMessage(error, "We couldn't sign that device out.")} />
        </div>
      ) : null}
    </>
  );
}

import { useIsMutating } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { AlertKind, NotificationPreference } from '@vehicle-vault/shared';
import { Fragment } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ErrorState } from '@/components/shared/error-state';
import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { PushDeviceSetting } from '@/features/notifications/components/push-device-setting';
import {
  UPDATE_NOTIFICATION_PREFERENCES_KEY,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/notifications/hooks/use-notification-preferences';
import { ALERT_KIND_COPY, ALERT_KIND_GROUPS } from '@/features/notifications/utils/alert-kind-copy';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

type Channel = 'email' | 'push';

export function NotificationPreferencesPage() {
  const { user } = useAuth();
  const query = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const isSaving = useIsMutating({ mutationKey: UPDATE_NOTIFICATION_PREFERENCES_KEY }) > 0;

  const title = 'Notification preferences';
  const description =
    'Choose how each kind of alert reaches you. Every alert stays in the bell in the app; these switches decide whether it also arrives by email or as a push notification.';

  if (query.isPending) {
    return (
      <PageContainer>
        <PageTitle description={description} title={title} />
        <LoadingState description="Getting your alert settings." title="Loading preferences" />
      </PageContainer>
    );
  }

  if (query.isError) {
    return (
      <PageContainer>
        <PageTitle description={description} title={title} />
        <ErrorState
          action={
            <Button onClick={() => void query.refetch()} variant="secondary">
              Try again
            </Button>
          }
          description={getApiErrorMessage(query.error, "We couldn't load your alert settings.")}
          title="Unable to load preferences"
        />
      </PageContainer>
    );
  }

  const saved = query.data.preferences;
  const preferences = new Map<AlertKind, NotificationPreference>(
    saved.map((preference) => [preference.kind, preference]),
  );
  const everyKindOn = (channel: Channel) => saved.every((preference) => preference[channel]);

  function setOne(kind: AlertKind, channel: Channel, on: boolean) {
    const current = preferences.get(kind);
    if (!current) return;
    update.mutate({ preferences: [{ ...current, [channel]: on }] });
  }

  function setAll(channel: Channel, on: boolean) {
    update.mutate({
      preferences: saved.map((preference) => ({ ...preference, [channel]: on })),
    });
  }

  return (
    <PageContainer>
      <PageTitle
        actions={
          <Link className={buttonVariants({ variant: 'outline' })} to="/settings">
            Back to Settings
          </Link>
        }
        description={description}
        title={title}
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Alerts</CardTitle>
              <CardDescription>
                Turning a kind off here never stops the app noticing it — you will still see it in
                the bell.
              </CardDescription>
            </div>
            <p aria-live="polite" className="shrink-0 text-xs font-medium text-slate-500">
              {isSaving ? 'Saving…' : update.isSuccess ? 'Saved' : null}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {update.isError ? (
              <InlineError
                message={`${getApiErrorMessage(
                  update.error,
                  "We couldn't save that change.",
                )} The switch has been put back.`}
              />
            ) : null}

            {user && !user.emailVerified ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                Email alerts start once your address is verified.
              </p>
            ) : null}

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-2 font-semibold" scope="col">
                    Alert
                  </th>
                  <th className="w-20 pb-2 text-center font-semibold" scope="col">
                    Email
                  </th>
                  <th className="w-20 pb-2 text-center font-semibold" scope="col">
                    Push
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-y border-slate-200 bg-slate-50/80">
                  <th className="px-2 py-3 text-left font-semibold text-slate-900" scope="row">
                    Every alert
                  </th>
                  {(['email', 'push'] as const).map((channel) => {
                    // An action rather than a switch: with some kinds on and some
                    // off, a switch reading "off" would claim every alert was off.
                    const turnOn = !everyKindOn(channel);

                    return (
                      <td className="py-3 text-center" key={channel}>
                        <Button
                          aria-label={`Turn ${channel} ${turnOn ? 'on' : 'off'} for every alert`}
                          className="h-7 px-2 text-xs"
                          onClick={() => setAll(channel, turnOn)}
                          size="sm"
                          variant="outline"
                        >
                          {turnOn ? 'Turn on' : 'Turn off'}
                        </Button>
                      </td>
                    );
                  })}
                </tr>

                {ALERT_KIND_GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    <tr>
                      <th
                        className="pb-1 pt-5 text-left text-xs font-bold uppercase tracking-wider text-slate-400"
                        colSpan={3}
                        scope="colgroup"
                      >
                        {group.title}
                      </th>
                    </tr>
                    {group.kinds.map((kind) => {
                      const copy = ALERT_KIND_COPY[kind];
                      const preference = preferences.get(kind);

                      return (
                        <tr className="border-b border-slate-100 last:border-b-0" key={kind}>
                          <th className="py-3 pr-4 text-left font-normal" scope="row">
                            <span className="block font-medium text-slate-900">{copy.label}</span>
                            <span className="block text-slate-500">{copy.description}</span>
                          </th>
                          {(['email', 'push'] as const).map((channel) => (
                            <td className="py-3 text-center" key={channel}>
                              <Switch
                                aria-label={`${copy.label} by ${channel}`}
                                checked={preference?.[channel] ?? true}
                                onCheckedChange={(on) => setOne(kind, channel, on)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>This device</CardTitle>
            <CardDescription>
              Push goes to each browser you turn it on in. The switches on the left decide which
              alerts are pushed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PushDeviceSetting />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

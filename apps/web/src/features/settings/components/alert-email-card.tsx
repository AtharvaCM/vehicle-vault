import { Mail, MailX } from 'lucide-react';

import { InlineError } from '@/components/shared/inline-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  useAlertEmailPreference,
  useSetAlertEmailPreference,
} from '@/features/notifications/hooks/use-alert-email-preference';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

function formatMutedAt(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * The signed-in end of the unsubscribe link, and the only place a muted user
 * can find their way back — an email they have opted out of will never arrive
 * to carry them there.
 *
 * Says out loud that this covers email alone. Someone silencing a channel
 * should not have to guess whether they have also turned off the thing that
 * notices their insurance is expiring.
 */
export function AlertEmailCard() {
  const auth = useAuth();
  const preference = useAlertEmailPreference();
  const setPreference = useSetAlertEmailPreference();

  const muted = preference.data?.muted ?? false;

  async function handleToggle() {
    const next = !muted;

    try {
      await setPreference.mutateAsync(next);
      appToast.success({
        title: next ? 'Alert emails turned off' : 'Alert emails turned on',
        description: next
          ? 'You will still see alerts in the app and in push notifications.'
          : "We'll email you when something needs attention.",
      });
    } catch (error) {
      appToast.error({
        title: "Couldn't update alert emails",
        description: getApiErrorMessage(
          error,
          "We couldn't save that preference. Try again in a moment.",
        ),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert emails</CardTitle>
        <CardDescription>
          Maintenance, renewal, and tyre alerts sent to {auth.user?.email}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
        {preference.isPending ? (
          <Skeleton className="h-6 w-40" />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">Alert emails:</span>
            <Badge variant={muted ? 'warning' : 'default'}>
              {muted ? (
                <>
                  <MailX />
                  Muted
                </>
              ) : (
                <>
                  <Mail />
                  On
                </>
              )}
            </Badge>
            {muted && preference.data?.mutedAt ? (
              <span className="text-slate-500">since {formatMutedAt(preference.data.mutedAt)}</span>
            ) : null}
          </div>
        )}

        <p>
          {muted
            ? 'We are not emailing you alerts. You still see every one of them in the app and in push notifications.'
            : 'Turning these off stops the email only. Alerts keep appearing in the app and in push notifications.'}
        </p>

        {preference.isError ? (
          <InlineError
            message={getApiErrorMessage(
              preference.error,
              "We couldn't load your email preference right now.",
            )}
          />
        ) : null}

        <Button
          className="w-full justify-center sm:w-auto"
          disabled={preference.isPending || setPreference.isPending}
          onClick={() => {
            void handleToggle();
          }}
          type="button"
          variant={muted ? 'default' : 'outline'}
        >
          {muted ? <Mail className="mr-2 h-4 w-4" /> : <MailX className="mr-2 h-4 w-4" />}
          {muted ? 'Turn alert emails back on' : 'Turn alert emails off'}
        </Button>
      </CardContent>
    </Card>
  );
}

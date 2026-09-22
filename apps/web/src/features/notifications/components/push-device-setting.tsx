import { Switch } from '@/components/ui/switch';
import { appToast } from '@/lib/toast';

import { isIos, isStandalone } from '@/features/pwa/platform';

import { usePushNotifications, type PushStatus } from '../hooks/use-push-notifications';

/** Why this device cannot take push, when it cannot. */
const UNAVAILABLE_REASON: Partial<Record<PushStatus, string>> = {
  loading: 'Checking this device…',
  unsupported: 'This browser can’t receive push notifications.',
  unavailable: 'Push notifications aren’t set up on the server yet.',
  denied: 'Notifications are blocked for this site in your browser settings.',
};

/**
 * iOS only delivers web push to an app added to the Home Screen, so in Safari
 * the honest answer is how to get there, not just that push is missing.
 */
const IOS_HOME_SCREEN_ROUTE =
  'On iPhone and iPad, notifications come to the Home Screen app: tap Share, then Add to Home Screen, and open Vehicle Vault from there.';

function unavailableReason(status: PushStatus): string | undefined {
  if (status === 'unsupported' && isIos() && !isStandalone()) return IOS_HOME_SCREEN_ROUTE;
  return UNAVAILABLE_REASON[status];
}

/**
 * Whether this browser is subscribed to push. Per device rather than per
 * account, which is why it sits apart from the per-kind switches: those decide
 * which alerts are pushed, this decides whether this device receives them.
 */
export function PushDeviceSetting() {
  const push = usePushNotifications();
  const reason = unavailableReason(push.status);

  async function handleChange(on: boolean) {
    if (!on) {
      await push.disable();
      appToast.success({
        title: 'Push turned off',
        description: 'This device will no longer get alerts.',
      });
      return;
    }

    const enabled = await push.enable();
    if (enabled) {
      appToast.success({
        title: 'Push turned on',
        description: 'Alerts will reach this device even when the tab is closed.',
      });
    } else if (push.status !== 'denied') {
      appToast.error({
        title: 'Could not turn on push',
        description: 'Check the browser’s notification permission and try again.',
      });
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-slate-900" id="push-device-label">
          Push notifications on this device
        </p>
        <p className="text-sm text-slate-500">
          {reason ?? 'Alerts arrive here even when Vehicle Vault is not open.'}
        </p>
      </div>
      <Switch
        aria-labelledby="push-device-label"
        checked={push.status === 'on'}
        disabled={reason !== undefined}
        onCheckedChange={(on) => void handleChange(on)}
      />
    </div>
  );
}

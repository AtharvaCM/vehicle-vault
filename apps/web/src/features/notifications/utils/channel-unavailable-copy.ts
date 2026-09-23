import type { NotificationChannelAvailability } from '@vehicle-vault/shared';

type Channel = 'email' | 'push';

/**
 * Why a channel can't deliver, in the words the preferences page shows next
 * to its disabled column. `email_unverified` has no entry here: the page
 * reuses the unverified-email banner it already shows instead of a second
 * line saying the same thing.
 */
const REASON_COPY: Record<Channel, Partial<Record<string, string>>> = {
  email: {
    not_configured: "Email alerts aren't available yet — every alert still appears in the bell",
  },
  push: {
    not_configured: 'Push notifications aren’t set up on the server yet.',
    no_device: 'Turn on push for this device to choose which alerts are pushed',
  },
};

/** The one-line explanation for a channel that can't deliver, or null when none applies. */
export function channelUnavailableCopy(
  channel: Channel,
  availability: NotificationChannelAvailability,
): string | null {
  if (availability.available || !availability.reason) return null;
  return REASON_COPY[channel][availability.reason] ?? null;
}

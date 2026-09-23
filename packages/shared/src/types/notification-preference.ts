import { z } from 'zod';

/**
 * Every kind of alert the API raises. Shared so the web app can offer a
 * preference for each one and the API can validate the kinds it is sent.
 *
 * Adding a kind means an AlertTemplate in the API (a test walks this list
 * against the registered templates) and a label in the web app's preferences
 * page (a `Record<AlertKind, ...>` there will not compile without one).
 */
export const ALERT_KINDS = [
  'maintenance-due',
  'maintenance-overdue',
  'reminder-due',
  'reminder-overdue',
  'document-expiring',
  'accessory-warranty-expiring',
  'warranty-odometer',
  'tyre-worn',
  'tyre-aged',
  'tyre-uninspected',
  'service-baseline-unknown',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

/**
 * Where one kind of alert is delivered, beyond the in-app notification that is
 * always created. Both channels default to on.
 */
export const NotificationPreferenceSchema = z.object({
  kind: z.enum(ALERT_KINDS),
  email: z.boolean(),
  push: z.boolean(),
});

export type NotificationPreference = z.infer<typeof NotificationPreferenceSchema>;

/**
 * Why a channel can't deliver right now. `not_configured` covers both the
 * mail transport and VAPID push being unset; `email_unverified` and
 * `no_device` are per-channel reasons that only make sense once the channel
 * itself is otherwise configured.
 */
export const NOTIFICATION_CHANNEL_UNAVAILABLE_REASONS = [
  'not_configured',
  'email_unverified',
  'no_device',
] as const;

export type NotificationChannelUnavailableReason =
  (typeof NOTIFICATION_CHANNEL_UNAVAILABLE_REASONS)[number];

export const NotificationChannelAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.enum(NOTIFICATION_CHANNEL_UNAVAILABLE_REASONS).nullable(),
});

export type NotificationChannelAvailability = z.infer<typeof NotificationChannelAvailabilitySchema>;

/**
 * Whether each channel can deliver at all, independent of any alert kind's
 * switch: email needs the mail transport configured and the address
 * verified, push needs VAPID configured and at least one subscribed device.
 * A switch for a channel that can't deliver must never read on.
 */
export type NotificationChannelsAvailability = {
  email: NotificationChannelAvailability;
  push: NotificationChannelAvailability;
};

/** Every kind, in `ALERT_KINDS` order, with what the API will actually do. */
export type NotificationPreferences = {
  preferences: NotificationPreference[];
  channels: NotificationChannelsAvailability;
};

/** The kinds to change; kinds left out keep their current setting. */
export type UpdateNotificationPreferencesInput = {
  preferences: NotificationPreference[];
};

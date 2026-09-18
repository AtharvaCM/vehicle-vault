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

/** Every kind, in `ALERT_KINDS` order, with what the API will actually do. */
export type NotificationPreferences = {
  preferences: NotificationPreference[];
};

/** The kinds to change; kinds left out keep their current setting. */
export type UpdateNotificationPreferencesInput = {
  preferences: NotificationPreference[];
};

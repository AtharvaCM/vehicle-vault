import type { Notification, User } from '@prisma/client';

/**
 * Every typed alert flowing through {@link NotifyService}.
 *
 * Extended by future slices (maintenance-overdue, reminder-due, reminder-overdue,
 * document-expiring). Keep `AlertPayloads` in lockstep when adding a kind.
 */
export type AlertKind = 'maintenance-due';

export type MaintenanceDuePayload = {
  vehicleId: string;
  category: string;
  remainingDistanceKm: number;
};

export type AlertPayloads = {
  'maintenance-due': MaintenanceDuePayload;
};

export type NotificationUrgency = 'info' | 'warning' | 'success' | 'error';

export type RenderedNotification = {
  title: string;
  message: string;
  type: NotificationUrgency;
  link: string | null;
};

export interface AlertTemplate<K extends AlertKind = AlertKind> {
  readonly kind: K;
  dedupKey(payload: AlertPayloads[K]): string;
  render(payload: AlertPayloads[K]): RenderedNotification;
}

export interface Channel {
  readonly name: string;
  deliver(notification: Notification, user: User): Promise<void>;
}

export const ALERT_TEMPLATES = Symbol('ALERT_TEMPLATES');
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

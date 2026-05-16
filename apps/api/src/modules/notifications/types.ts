import type { Notification, User } from '@prisma/client';

/**
 * Every typed alert flowing through {@link NotifyService}.
 *
 * Extended by future slices (document-expiring lands with the
 * VehicleDocument deepening). Keep `AlertPayloads` in lockstep when
 * adding a kind.
 */
export type AlertKind =
  | 'maintenance-due'
  | 'maintenance-overdue'
  | 'reminder-due'
  | 'reminder-overdue';

export type MaintenanceDuePayload = {
  vehicleId: string;
  category: string;
  remainingDistanceKm: number;
};

export type MaintenanceOverduePayload = {
  vehicleId: string;
  category: string;
  /** Negative or zero when overdue; absolute value is the distance past the interval. */
  remainingDistanceKm: number;
};

export type ReminderDuePayload = {
  reminderId: string;
  vehicleId: string;
  title: string;
  dueOdometer: number;
  remainingDistanceKm: number;
};

export type ReminderOverduePayload = {
  reminderId: string;
  vehicleId: string;
  title: string;
  dueOdometer: number;
  remainingDistanceKm: number;
};

export type AlertPayloads = {
  'maintenance-due': MaintenanceDuePayload;
  'maintenance-overdue': MaintenanceOverduePayload;
  'reminder-due': ReminderDuePayload;
  'reminder-overdue': ReminderOverduePayload;
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

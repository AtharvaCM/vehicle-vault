import type { Notification, User } from '@prisma/client';
import type { TyreConditionLevel, TyrePosition, VehicleDocument } from '@vehicle-vault/shared';

/**
 * Every typed alert flowing through {@link NotifyService}.
 *
 * Keep `AlertPayloads` in lockstep when adding a kind.
 */
export type AlertKind =
  | 'maintenance-due'
  | 'maintenance-overdue'
  | 'reminder-due'
  | 'reminder-overdue'
  | 'document-expiring'
  | 'accessory-warranty-expiring'
  | 'tyre-worn'
  | 'tyre-aged'
  | 'tyre-uninspected';

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

export type DocumentExpiringPayload = {
  document: VehicleDocument;
  daysUntilExpiry: number;
};

/**
 * Structural rather than tied to the Prisma row, so the notifications module
 * takes no dependency on the accessories schema. Dates stay Date objects here
 * because the template formats them; the wire type carries ISO strings.
 */
export type AccessoryWarrantyExpiringPayload = {
  accessory: {
    id: string;
    vehicleId: string;
    name: string;
    brand: string | null;
    warrantyExpiresAt: Date | null;
  };
  daysUntilExpiry: number;
};

/**
 * Levels worth telling someone about. `healthy` needs no alert and `unknown`
 * is the absence of a measurement, which {@link TyreUninspectedPayload} covers
 * instead — a tyre nobody has measured is not a worn tyre.
 */
export type AlertableTyreLevel = Exclude<TyreConditionLevel, 'healthy' | 'unknown'>;

/**
 * Tread and manufacture age are graded by the tyres module; these payloads carry
 * the verdict rather than the raw measurements so the notifications module never
 * grows a second opinion about when a tyre is finished.
 */
export type TyreWornPayload = {
  vehicleId: string;
  tyreId: string;
  position: TyrePosition;
  level: AlertableTyreLevel;
  /** The resolver's own justification, e.g. "1.4 mm tread — below the 1.6 mm legal minimum". */
  summary: string;
  treadDepthMm: number | null;
};

/** Age never makes a tyre illegal — that is a roadworthiness test on tread alone. */
export type TyreAgedPayload = {
  vehicleId: string;
  tyreId: string;
  position: TyrePosition;
  level: Exclude<AlertableTyreLevel, 'illegal'>;
  summary: string;
  ageYears: number | null;
};

/**
 * The app cannot see this vehicle's tyres. Split by cause because the two ask
 * for different things: `untracked` wants the tyres entered at all, `stale`
 * wants a fresh reading on tyres already recorded.
 */
export type TyreUninspectedPayload = {
  vehicleId: string;
  odometer: number;
} & (
  | { reason: 'untracked' }
  | { reason: 'stale'; kmSinceLastCheck: number; daysSinceLastCheck: number }
);

export type AlertPayloads = {
  'maintenance-due': MaintenanceDuePayload;
  'maintenance-overdue': MaintenanceOverduePayload;
  'reminder-due': ReminderDuePayload;
  'reminder-overdue': ReminderOverduePayload;
  'document-expiring': DocumentExpiringPayload;
  'accessory-warranty-expiring': AccessoryWarrantyExpiringPayload;
  'tyre-worn': TyreWornPayload;
  'tyre-aged': TyreAgedPayload;
  'tyre-uninspected': TyreUninspectedPayload;
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

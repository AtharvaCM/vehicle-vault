import type { Notification, User } from '@prisma/client';
import type { TyreConditionLevel, TyrePosition, VehicleDocument } from '@vehicle-vault/shared';

/**
 * Every typed alert flowing through {@link NotifyService}.
 *
 * Declared as a value so the set is enumerable at runtime: a kind with no
 * registered **AlertTemplate** only fails inside `NotifyService.raise`, which
 * the cron catches per vehicle and logs — the alert simply never arrives. The
 * companion test walks this list against the registered templates.
 *
 * Keep `AlertPayloads` in lockstep when adding a kind.
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

/**
 * A reminder can be timed two ways and the copy for each is genuinely
 * different: one talks in kilometres, the other in calendar days. Modelled as
 * a union rather than four optional fields so a date reminder cannot carry an
 * odometer the template would then be tempted to mention — a reminder created
 * with only a renewal date has no km to quote, and inventing one from the
 * mileage forecast is exactly what the engine refuses to do elsewhere.
 */
export type ReminderAlertBasis =
  | {
      basis: 'odometer';
      dueOdometer: number;
      /** Negative when the vehicle is already past the mark. */
      remainingDistanceKm: number;
    }
  | {
      basis: 'date';
      dueDate: Date;
      /** Whole UTC calendar days; 0 is due today, negative is past due. */
      daysUntilDue: number;
    };

/**
 * `reminder-due` and `reminder-overdue` carry the same facts and differ only in
 * the verdict the engine reached, so they share one payload shape.
 */
export type ReminderAlertPayload = {
  reminderId: string;
  vehicleId: string;
  title: string;
} & ReminderAlertBasis;

export type ReminderDuePayload = ReminderAlertPayload;

export type ReminderOverduePayload = ReminderAlertPayload;

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

/**
 * The app cannot time a reminder because it does not know when something was
 * last done. Split by scope because the two are asking for different things:
 * `vehicle` wants a history that has never been started, `category` chases the
 * one item whose owner has explicitly said they do not know.
 *
 * Never raised for a category merely missing a baseline row. Every vehicle in
 * the database predates this table, and treating "not asked" as "unknown" would
 * greet each of them with a notification per service category.
 */
export type ServiceBaselineUnknownPayload = {
  vehicleId: string;
  odometer: number;
} & (
  | { scope: 'vehicle' }
  | {
      scope: 'category';
      category: string;
      /** The interval this category would have been measured against, in km. */
      intervalKm: number;
    }
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
  'service-baseline-unknown': ServiceBaselineUnknownPayload;
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
  /**
   * What counts as "the same alert" when a caller asks for a cooldown — see
   * `RaiseOptions.cooldownDays`. Coarser than `dedupKey`, which may carry a
   * bucket so an unread row can be superseded; a cooldown is about the person,
   * and a prompt they dismissed last month is the same prompt whatever bucket
   * the odometer has since moved into.
   *
   * Must be a prefix of every `dedupKey` this template produces for the same
   * payload. Optional: without it a cooldown matches on the exact `dedupKey`.
   */
  cooldownKey?(payload: AlertPayloads[K]): string;
  render(payload: AlertPayloads[K]): RenderedNotification;
}

/**
 * How a single raise should behave beyond the default of "create the row once
 * per unread dedup key and deliver it everywhere".
 */
export type RaiseOptions = {
  /**
   * Skip the raise entirely when this user has had the same alert — as the
   * template's `cooldownKey` defines "same" — within this many days, whether
   * they read it, ignored it or deleted it. The default dedup only guards
   * unread rows, so without this a read or deleted prompt comes back the next
   * morning.
   *
   * Remembered in **AlertRaise**, which every raise under a cooldown writes to,
   * rather than in the Notification rows, which the user is free to delete.
   */
  cooldownDays?: number;
  /**
   * Create the **Notification** row and deliver it through no external
   * Channel. For alerts worth recording but not worth interrupting someone
   * for — the row is still there when they next open the app.
   */
  inAppOnly?: boolean;
};

export interface Channel {
  readonly name: string;
  deliver(notification: Notification, user: User): Promise<void>;
}

export const ALERT_TEMPLATES = Symbol('ALERT_TEMPLATES');
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

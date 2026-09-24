import {
  ReminderStatus,
  VehicleRole,
  type DashboardAttentionItem,
  type Reminder,
  type UpcomingItem,
  type UpcomingUrgency,
  type Vehicle,
  type VehicleDocument,
  type VehicleDocumentKind,
  type VehicleLoan,
} from '@vehicle-vault/shared';

import { isAlertedFromMeasurements, type AlertVerdict } from '../notifications/alert-verdicts';
import { positionLabel } from '../notifications/templates/tyre-labels';
import { isMoreRecentDocument } from '../vehicle-documents/document-recency';

/**
 * The one classification of everything with a date across a user's vehicles.
 * Home's attention queue is these items minus `later`; the Upcoming timeline
 * is all of them. Both run this code on the same rows, so the two pages cannot
 * disagree about what is late or due this week.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Expired documents older than this fall off the timeline (they are still `expired` on the vehicle). */
const DOCUMENT_OVERDUE_WINDOW_DAYS = 90;
/** Odometer-only reminders enter the queue once the vehicle is within this many km of the target. */
const ODOMETER_ATTENTION_KM = 1000;
export const THIS_WEEK_MAX_DAYS = 7;
export const THIS_MONTH_MAX_DAYS = 30;

const URGENCY_RANK: Record<UpcomingUrgency, number> = {
  overdue: 0,
  today: 1,
  this_week: 2,
  this_month: 3,
  later: 4,
};

const DOCUMENT_KIND_TITLES: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance policy',
  warranty: 'Warranty coverage',
  registration: 'Registration certificate',
  puc: 'PUC certificate',
  road_tax: 'Road tax',
};

/**
 * The bell's tyre titles, in the queue's sentence case. The position goes in
 * the detail line instead of the title, so a phone-width row keeps it.
 */
const TYRE_WORN_TITLES = {
  illegal: 'Tyre not roadworthy',
  replace: 'Replace tyre',
  warn: 'Tyre wearing down',
} as const;
const TYRE_AGED_TITLES = { replace: 'Tyre aged out', warn: 'Tyre ageing' } as const;

/** How many unanswered categories a service-history row names before it says "and N more". */
const SERVICE_HISTORY_NAMED_CATEGORIES = 2;

/** The verdicts the queue shows: the ones the bell raises about tyres and service history. */
export type QueueVerdict = AlertVerdict<
  'tyre-worn' | 'tyre-aged' | 'tyre-uninspected' | 'service-baseline-unknown'
>;

/** The vehicle fields a row names its vehicle by. */
export type DueItemVehicle = Pick<
  Vehicle,
  'id' | 'nickname' | 'make' | 'model' | 'registrationNumber' | 'odometer'
> & { currentUserRole?: VehicleRole };

export type ExpiringAccessoryRow = {
  id: string;
  vehicleId: string;
  name: string;
  brand: string | null;
  warrantyExpiresAt: Date | null;
};

export type DueItemsInput = {
  vehicleById: ReadonlyMap<string, DueItemVehicle>;
  reminders: readonly Reminder[];
  /** Latest document per (vehicle, kind): see {@link latestDocumentPerVehicleKind}. */
  latestDocuments: ReadonlyMap<string, VehicleDocument>;
  activeLoans: readonly VehicleLoan[];
  /** The engine's verdicts per vehicle, already narrowed to what this user hears. */
  verdictsByVehicle: ReadonlyMap<string, readonly QueueVerdict[]>;
  expiringAccessories: readonly ExpiringAccessoryRow[];
  /** `toUtcDay(now)`: one clock reading per request, so every row agrees on today. */
  today: number;
  /** Live document snoozes for this user, by document id. */
  documentSnoozes: ReadonlyMap<string, Date>;
};

type RowVehicleFields = Pick<
  DashboardAttentionItem,
  'vehicleId' | 'vehicleName' | 'registrationNumber' | 'currentUserRole'
>;

/** Home's rows: everything classified, minus what it leaves for later. */
export function isAttentionItem(item: UpcomingItem): item is DashboardAttentionItem {
  return item.urgency !== 'later';
}

/**
 * Every reminder, paper, EMI, verdict and accessory warranty with something
 * to say, classified and sorted (urgency, then date, then km, then title).
 */
export function buildDueItems(input: DueItemsInput): UpcomingItem[] {
  const {
    vehicleById,
    reminders,
    latestDocuments,
    activeLoans,
    verdictsByVehicle,
    expiringAccessories,
    today,
    documentSnoozes,
  } = input;
  const items: UpcomingItem[] = [];

  for (const reminder of reminders) {
    if (reminder.status === ReminderStatus.Completed) continue;
    // The tyre walk-around is judged from the readings, as in the bell: the
    // `tyre-check` row below, not this one.
    if (isAlertedFromMeasurements(reminder)) continue;
    const vehicle = vehicleById.get(reminder.vehicleId);
    if (!vehicle) continue;

    const dueDate = reminder.dueDate ?? null;
    const daysUntilDue = dueDate === null ? null : daysUntil(today, dueDate);
    const kmUntilDue =
      reminder.dueOdometer === undefined ? undefined : reminder.dueOdometer - vehicle.odometer;
    const urgency = reminderUrgency(reminder.status, daysUntilDue, kmUntilDue);
    if (!urgency) continue;

    items.push({
      ...rowVehicleFields(vehicle),
      id: reminder.id,
      kind: 'reminder',
      urgency,
      title: reminder.title,
      reminderType: reminder.type,
      reminderStatus: reminder.status,
      dueDate,
      daysUntilDue,
      dueOdometer: reminder.dueOdometer,
      kmUntilDue,
    });
  }

  for (const document of latestDocuments.values()) {
    // A superseded policy never shows as expired: only the latest per
    // (vehicle, kind) is considered, and an open-ended one never expires.
    if (document.endDate === null) continue;
    const vehicle = vehicleById.get(document.vehicleId);
    if (!vehicle) continue;

    const daysUntilDue = daysUntil(today, document.endDate);
    let urgency = documentUrgency(daysUntilDue);
    if (!urgency) continue;
    // A snooze only defers the heads-up window; it never hides a document
    // that has actually come due.
    const snoozedUntil = documentSnoozes.get(document.id);
    const snoozed =
      snoozedUntil !== undefined && (urgency === 'this_week' || urgency === 'this_month');
    if (snoozed) urgency = 'later';

    items.push({
      ...rowVehicleFields(vehicle),
      id: document.id,
      kind: 'document',
      urgency,
      title: DOCUMENT_KIND_TITLES[document.kind],
      documentKind: document.kind,
      provider: document.provider ?? undefined,
      dueDate: document.endDate.toISOString(),
      daysUntilDue,
      ...(snoozed ? { snoozedUntil: snoozedUntil.toISOString() } : {}),
    });
  }

  for (const loan of activeLoans) {
    const vehicle = vehicleById.get(loan.vehicleId);
    if (!vehicle) continue;

    const nextEmi = nextEmiDateFor(loan);
    const daysUntilDue = daysUntil(today, nextEmi);
    const urgency = emiUrgency(daysUntilDue);
    if (!urgency) continue;

    items.push({
      ...rowVehicleFields(vehicle),
      id: `emi:${loan.id}`,
      kind: 'loan_emi',
      urgency,
      title: 'Loan EMI',
      loanId: loan.id,
      amount: loan.emiAmount,
      dueDate: nextEmi.toISOString(),
      daysUntilDue,
    });
  }

  for (const [vehicleId, verdicts] of verdictsByVehicle) {
    const vehicle = vehicleById.get(vehicleId);
    if (!vehicle) continue;

    items.push(...verdictRows(rowVehicleFields(vehicle), verdicts));
  }

  for (const accessory of expiringAccessories) {
    const vehicle = vehicleById.get(accessory.vehicleId);
    if (!vehicle || !accessory.warrantyExpiresAt) continue;

    // The lookup starts at today, so nothing here has run out; a warranty
    // ending before today's UTC date is only a server-timezone edge.
    const daysUntilDue = Math.max(0, daysUntil(today, accessory.warrantyExpiresAt));
    const urgency = documentUrgency(daysUntilDue);
    if (!urgency) continue;

    items.push({
      ...rowVehicleFields(vehicle),
      id: `accessory:${accessory.id}`,
      kind: 'accessory',
      urgency,
      title: `${accessory.brand ? `${accessory.brand} ${accessory.name}` : accessory.name} warranty`,
      dueDate: accessory.warrantyExpiresAt.toISOString(),
      daysUntilDue,
    });
  }

  return items.sort(compareDueItems);
}

/**
 * One row per tyre the engine would raise, and one per vehicle for each
 * question it would ask. The categories whose history is unknown share one
 * row: the bell asks about each on its own rhythm, but they are answered on
 * the same screen, and a row apiece would bury everything else coming up.
 */
function verdictRows(
  vehicle: RowVehicleFields,
  verdicts: readonly QueueVerdict[],
): DashboardAttentionItem[] {
  const rows: DashboardAttentionItem[] = [];
  const unknownCategories: string[] = [];
  const undated = { dueDate: null, daysUntilDue: null } as const;

  for (const verdict of verdicts) {
    switch (verdict.kind) {
      case 'tyre-worn': {
        const { payload } = verdict;
        rows.push({
          ...vehicle,
          ...undated,
          id: `tyre:${payload.tyreId}`,
          kind: 'tyre',
          urgency: payload.level === 'warn' ? 'this_month' : 'overdue',
          title: TYRE_WORN_TITLES[payload.level],
          detail: `${positionLabel(payload.position)} · ${
            payload.treadDepthMm === null
              ? payload.summary
              : `${payload.treadDepthMm.toFixed(1)} mm tread`
          }`,
        });
        break;
      }
      case 'tyre-aged': {
        const { payload } = verdict;
        rows.push({
          ...vehicle,
          ...undated,
          id: `tyre:${payload.tyreId}`,
          kind: 'tyre',
          urgency: payload.level === 'warn' ? 'this_month' : 'overdue',
          title: TYRE_AGED_TITLES[payload.level],
          detail: `${positionLabel(payload.position)} · ${
            payload.ageYears === null ? payload.summary : `${payload.ageYears.toFixed(1)} years old`
          }`,
        });
        break;
      }
      case 'tyre-uninspected': {
        const { payload } = verdict;
        rows.push({
          ...vehicle,
          ...undated,
          id: `tyre-check:${payload.vehicleId}`,
          kind: 'tyre',
          urgency: 'this_month',
          ...(payload.reason === 'untracked'
            ? { title: 'Tyres not tracked', detail: `None on file at ${km(payload.odometer)}` }
            : {
                title: 'Time to check the tyres',
                detail: `Last measured ${km(payload.kmSinceLastCheck)} and ${
                  payload.daysSinceLastCheck
                } day${payload.daysSinceLastCheck === 1 ? '' : 's'} ago`,
              }),
        });
        break;
      }
      case 'service-baseline-unknown': {
        const { payload } = verdict;
        if (payload.scope === 'category') {
          unknownCategories.push(payload.category);
          break;
        }
        rows.push({
          ...vehicle,
          ...undated,
          id: `service-history:${payload.vehicleId}`,
          kind: 'service_baseline',
          urgency: 'this_month',
          title: 'Add this vehicle’s service history',
          detail: `None on file at ${km(payload.odometer)}`,
        });
        break;
      }
    }
  }

  if (unknownCategories.length > 0) {
    const named = unknownCategories.slice(0, SERVICE_HISTORY_NAMED_CATEGORIES).map(categoryWords);
    const more = unknownCategories.length - named.length;
    const list = more > 0 ? `${named.join(', ')} and ${more} more` : named.join(' and ');

    rows.push({
      ...vehicle,
      ...undated,
      id: `service-history:${vehicle.vehicleId}`,
      kind: 'service_baseline',
      urgency: 'this_month',
      title: 'Unknown service history',
      detail: `${list.charAt(0).toUpperCase()}${list.slice(1)}`,
    });
  }

  return rows;
}

/**
 * Urgency comes from the reminder's own status so a row can never contradict
 * the reminder itself; only the "how soon" bucketing is local. A reminder
 * that is still upcoming beyond Home's window is `later`, never dropped.
 */
function reminderUrgency(
  status: ReminderStatus,
  daysUntilDue: number | null,
  kmUntilDue: number | undefined,
): UpcomingUrgency | null {
  if (status === ReminderStatus.Overdue) return 'overdue';
  if (status === ReminderStatus.DueToday) return 'today';
  if (status !== ReminderStatus.Upcoming) return null;

  if (daysUntilDue === null) {
    return kmUntilDue !== undefined && kmUntilDue <= ODOMETER_ATTENTION_KM ? 'this_month' : 'later';
  }

  return dateUrgency(daysUntilDue);
}

/** Null only for a paper that ran out more than 90 days ago. */
function documentUrgency(daysUntilDue: number): UpcomingUrgency | null {
  if (daysUntilDue < 0) {
    return daysUntilDue >= -DOCUMENT_OVERDUE_WINDOW_DAYS ? 'overdue' : null;
  }
  if (daysUntilDue === 0) return 'today';

  return dateUrgency(daysUntilDue);
}

/**
 * An instalment is routine: it needs attention only in its own week. Null for
 * a date already past, which only a loan whose schedule has not been brought
 * up to date can produce.
 */
function emiUrgency(daysUntilDue: number): UpcomingUrgency | null {
  if (daysUntilDue < 0) return null;
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue >= 1 && daysUntilDue <= THIS_WEEK_MAX_DAYS) return 'this_week';

  return 'later';
}

/** Future-dated bucketing shared by every kind: 1–7 this week, 8–30 this month, beyond that later. */
function dateUrgency(daysUntilDue: number): UpcomingUrgency | null {
  if (daysUntilDue < 1) return null;
  if (daysUntilDue <= THIS_WEEK_MAX_DAYS) return 'this_week';
  if (daysUntilDue <= THIS_MONTH_MAX_DAYS) return 'this_month';

  return 'later';
}

/**
 * Urgency bucket first; within a bucket dated items by days-until-due,
 * then odometer-only items by km-until-due, then title, then vehicle.
 */
export function compareDueItems(left: UpcomingItem, right: UpcomingItem): number {
  const rankDifference = URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency];
  if (rankDifference !== 0) return rankDifference;

  const leftDated = left.daysUntilDue !== null;
  const rightDated = right.daysUntilDue !== null;
  if (leftDated !== rightDated) return leftDated ? -1 : 1;

  if (left.daysUntilDue !== null && right.daysUntilDue !== null) {
    if (left.daysUntilDue !== right.daysUntilDue) return left.daysUntilDue - right.daysUntilDue;
  } else {
    const leftKm = left.kmUntilDue ?? Number.POSITIVE_INFINITY;
    const rightKm = right.kmUntilDue ?? Number.POSITIVE_INFINITY;
    if (leftKm !== rightKm) return leftKm < rightKm ? -1 : 1;
  }

  return (
    left.title.localeCompare(right.title) ||
    // Same thing, same day, on two vehicles (three PUCs renewed together):
    // alphabetical by vehicle, so the order never depends on the query's.
    left.vehicleName.localeCompare(right.vehicleName) ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Latest document per (vehicle, kind), decided by startDate: a renewal always
 * starts after what it replaces, so a renewed policy hides the one it replaced
 * and a dated certificate entered after an open-ended one is not masked by it.
 * Equal start dates fall back to endDate, where null (open-ended) ranks latest.
 */
export function latestDocumentPerVehicleKind(
  documents: readonly VehicleDocument[],
): Map<string, VehicleDocument> {
  const latest = new Map<string, VehicleDocument>();
  for (const document of documents) {
    const key = `${document.vehicleId}:${document.kind}`;
    const current = latest.get(key);
    if (!current || isMoreRecentDocument(document, current)) {
      latest.set(key, document);
    }
  }

  return latest;
}

/**
 * Next instalment = startDate + (elapsed + 1) months, with the day clamped into the
 * target month so a loan started on the 31st is due on the 28th/30th of shorter
 * months instead of spilling into the month after.
 */
export function nextEmiDateFor(
  loan: Pick<VehicleLoan, 'tenureMonths' | 'monthsRemaining' | 'startDate'>,
): Date {
  const elapsed = loan.tenureMonths - loan.monthsRemaining;
  const start = new Date(loan.startDate);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + elapsed + 1, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), daysInTargetMonth));
  target.setUTCHours(
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  );

  return target;
}

export function displayNameFor(vehicle: Pick<Vehicle, 'nickname' | 'make' | 'model'>): string {
  return vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
}

/** Whole UTC calendar days from `today` (a `toUtcDay` value) to `value`; negative when past. */
export function daysUntil(today: number, value: string | Date): number {
  return Math.round((toUtcDay(value) - today) / MS_PER_DAY);
}

/** Midnight-UTC timestamp of the UTC date — mirrors `RemindersService.toUtcDayTimestamp`. */
export function toUtcDay(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function rowVehicleFields(vehicle: DueItemVehicle): RowVehicleFields {
  return {
    vehicleId: vehicle.id,
    vehicleName: displayNameFor(vehicle),
    registrationNumber: vehicle.registrationNumber,
    currentUserRole: vehicle.currentUserRole ?? VehicleRole.Owner,
  };
}

function km(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString('en-IN')} km`;
}

/** "engine_oil" → "engine oil", "cvt_belt" → "CVT belt". */
function categoryWords(category: string): string {
  return category.replace(/_/g, ' ').replace(/\b(cvt|puc)\b/g, (word) => word.toUpperCase());
}

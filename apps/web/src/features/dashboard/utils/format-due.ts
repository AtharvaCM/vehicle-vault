import { format } from '@/lib/format';

import type { DashboardAttentionKind, DashboardUrgency } from '../types/dashboard';

type FormatRelativeDueInput = {
  kind: DashboardAttentionKind;
  daysUntilDue: number | null;
  dueDate: string | null;
  dueOdometer?: number;
  kmUntilDue?: number;
  /** An undated verdict's own wording, e.g. "2.8 mm tread". */
  detail?: string;
};

/** Kinds whose date is when something runs out, not when something is due. */
const EXPIRING_KINDS: readonly DashboardAttentionKind[] = ['document', 'accessory'];

function pluralize(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** Odometer meta segment: "at 45,000 km · 800 km to go". */
export function formatOdometerMeta(dueOdometer: number, kmUntilDue?: number) {
  const base = `at ${format.odometer(dueOdometer)}`;

  if (kmUntilDue === undefined) {
    return base;
  }

  return `${base} · ${format.distance(Math.abs(kmUntilDue))} ${kmUntilDue < 0 ? 'past due' : 'to go'}`;
}

/** Odometer-only wording: "Due at 45,000 km · 800 km to go". */
export function formatOdometerDue(dueOdometer: number, kmUntilDue?: number) {
  return `Due ${formatOdometerMeta(dueOdometer, kmUntilDue)}`;
}

/**
 * When a row is due, in words that give the time: "3 days late", "Today",
 * "In 4 days" for things to do; "153 days left", "Ended 20 Sep" for papers and
 * warranties that run out. The API's day count wins over a local one so the
 * words agree with the group the row sits in. When both a date and an odometer
 * exist the date is primary — callers render the odometer as a separate meta
 * segment. An undated verdict (a worn tyre, unknown service history) says what
 * it rests on instead.
 */
export function formatRelativeDue({
  kind,
  daysUntilDue,
  dueDate,
  dueOdometer,
  kmUntilDue,
  detail,
}: FormatRelativeDueInput) {
  if (!dueDate) {
    if (dueOdometer === undefined) {
      return detail ?? 'No due date';
    }

    return formatOdometerDue(dueOdometer, kmUntilDue);
  }

  return format.relativeDue(dueDate, {
    mode: EXPIRING_KINDS.includes(kind) ? 'ends' : 'due',
    days: daysUntilDue,
  });
}

/** "today" / "yesterday" / "N days/weeks/months/years ago", from a past ISO datetime. */
export function formatRelativeAgo(dateIso: string, today: Date = new Date()) {
  const daysAgo = Math.max(0, -(format.daysUntil(dateIso, today) ?? 0));

  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo < 7) return `${pluralize(daysAgo, 'day')} ago`;
  if (daysAgo < 30) return `${pluralize(Math.floor(daysAgo / 7), 'week')} ago`;
  if (daysAgo < 365) return `${pluralize(Math.floor(daysAgo / 30), 'month')} ago`;

  return `${pluralize(Math.floor(daysAgo / 365), 'year')} ago`;
}

export function urgencyLabel(urgency: DashboardUrgency) {
  switch (urgency) {
    case 'overdue':
      return 'Overdue';
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This week';
    case 'this_month':
      return 'Next 30 days';
  }
}

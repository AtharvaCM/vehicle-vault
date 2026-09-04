import { formatDate } from '@/lib/utils/format-date';

import type { DashboardAttentionKind, DashboardUrgency } from '../types/dashboard';

const MS_PER_DAY = 86_400_000;

type FormatRelativeDueInput = {
  kind: DashboardAttentionKind | 'reminder' | 'document';
  daysUntilDue: number | null;
  dueDate: string | null;
  dueOdometer?: number;
  kmUntilDue?: number;
};

export function formatKm(value: number) {
  return `${Math.round(value).toLocaleString('en-IN')} km`;
}

function pluralize(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function toUtcDay(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole UTC calendar days from `today` to `target`; negative when `target` is in the past. */
export function calendarDaysUntil(target: string | Date, today: string | Date) {
  return Math.round((toUtcDay(target) - toUtcDay(today)) / MS_PER_DAY);
}

/** Odometer meta segment: "at 45,000 km · 800 km to go". */
export function formatOdometerMeta(dueOdometer: number, kmUntilDue?: number) {
  const base = `at ${formatKm(dueOdometer)}`;

  if (kmUntilDue === undefined) {
    return base;
  }

  return `${base} · ${formatKm(Math.abs(kmUntilDue))} ${kmUntilDue < 0 ? 'past due' : 'to go'}`;
}

/** Odometer-only wording: "Due at 45,000 km · 800 km to go". */
export function formatOdometerDue(dueOdometer: number, kmUntilDue?: number) {
  return `Due ${formatOdometerMeta(dueOdometer, kmUntilDue)}`;
}

function formatDocumentDue(days: number, dueDate: string) {
  if (days < -30) {
    return `Expired ${formatDate(dueDate)}`;
  }

  if (days < 0) {
    return `Expired ${pluralize(-days, 'day')} ago`;
  }

  if (days === 0) {
    return 'Expires today';
  }

  if (days === 1) {
    return 'Expires tomorrow';
  }

  if (days <= 30) {
    return `Expires in ${days} days`;
  }

  return `Expires ${formatDate(dueDate)}`;
}

function formatReminderDue(days: number, dueDate: string) {
  if (days < -30) {
    return `Overdue since ${formatDate(dueDate)}`;
  }

  if (days < 0) {
    return `${pluralize(-days, 'day')} overdue`;
  }

  if (days === 0) {
    return 'Due today';
  }

  if (days === 1) {
    return 'Due tomorrow';
  }

  if (days <= 30) {
    return `Due in ${days} days`;
  }

  return `Due ${formatDate(dueDate)}`;
}

/**
 * Human relative due string. When both a date and an odometer exist the date
 * string is primary — callers render the odometer as a separate meta segment.
 */
export function formatRelativeDue({
  kind,
  daysUntilDue,
  dueDate,
  dueOdometer,
  kmUntilDue,
}: FormatRelativeDueInput) {
  if (!dueDate) {
    if (dueOdometer === undefined) {
      return 'No due date';
    }

    return formatOdometerDue(dueOdometer, kmUntilDue);
  }

  if (daysUntilDue === null) {
    return `${kind === 'document' ? 'Expires' : 'Due'} ${formatDate(dueDate)}`;
  }

  if (kind === 'document') {
    return formatDocumentDue(daysUntilDue, dueDate);
  }

  return formatReminderDue(daysUntilDue, dueDate);
}

/** "today" / "yesterday" / "N days/weeks/months/years ago", from a past ISO datetime. */
export function formatRelativeAgo(dateIso: string, today: Date = new Date()) {
  const daysAgo = Math.max(0, -calendarDaysUntil(dateIso, today));

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

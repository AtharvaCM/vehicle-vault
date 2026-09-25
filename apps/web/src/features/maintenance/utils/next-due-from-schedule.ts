import type { VehicleServiceInterval } from '@vehicle-vault/shared';

/** When the next one of a service is due: a `yyyy-MM-dd` date, a reading, or both. */
export type NextDue = {
  date?: string;
  odometer?: number;
};

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A `yyyy-MM-dd` date so many months on, as a calendar reads it. A day the
 * month lacks rolls over (31 Jan + 1 month is 3 Mar), as the API's `addMonths`
 * does, so the web and the API agree on every date.
 */
export function addMonthsToDateInput(value: string, months: number): string | undefined {
  const match = DATE_INPUT.exec(value.trim());
  if (!match) return undefined;

  const [, year, month, day] = match;
  const next = new Date(Date.UTC(Number(year), Number(month) - 1 + months, Number(day)));

  return Number.isNaN(next.getTime()) ? undefined : next.toISOString().slice(0, 10);
}

/**
 * The next one of a service, worked out from the vehicle's schedule (its
 * resolved interval for the category, `GET /vehicles/:id/intervals`, the same
 * numbers the alert and forecast engines use) and counted from this service:
 * its date plus the months, its reading plus the kilometres. Null when the
 * schedule has no interval for the work or the service has nothing to count from.
 */
export function nextDueFromSchedule(
  interval: VehicleServiceInterval | undefined,
  service: { serviceDate: string | undefined; odometer: number | undefined },
): NextDue | null {
  if (!interval) return null;

  const date =
    interval.months != null && service.serviceDate
      ? addMonthsToDateInput(service.serviceDate, interval.months)
      : undefined;
  const odometer =
    interval.km != null &&
    typeof service.odometer === 'number' &&
    Number.isInteger(service.odometer) &&
    service.odometer > 0
      ? service.odometer + interval.km
      : undefined;

  return date || odometer !== undefined ? { date, odometer } : null;
}

/** What the schedule says about the next one, once this service is saved. */
export type ScheduledNextDue =
  | { kind: 'due'; due: NextDue }
  /** The schedule has no interval for this work on this vehicle. */
  | { kind: 'unscheduled' }
  /** A later service of the same kind is logged: that one sets the next due. */
  | { kind: 'superseded' }
  /** A back-filled service whose next one would already be due on every count. */
  | { kind: 'passed' };

type LoggedService = {
  id: string;
  category: string;
  serviceDate: string;
  odometer: number;
  status?: string;
};

/**
 * The next due this service would leave, by the schedule. Only the latest
 * service of its kind sets one (the API's schedule counts from the latest),
 * and a next due already reached on every count is not set, as the API does
 * not schedule a repeat that is born due.
 */
export function scheduledNextDue(input: {
  interval: VehicleServiceInterval | undefined;
  category: string;
  serviceDate: string | undefined;
  odometer: number | undefined;
  /** The vehicle's other services; drafts count for nothing. */
  records: readonly LoggedService[];
  excludeRecordId?: string;
  currentOdometer: number | undefined;
  /** Today as `yyyy-MM-dd`. */
  today: string;
}): ScheduledNextDue {
  const due = nextDueFromSchedule(input.interval, input);
  if (!due) return { kind: 'unscheduled' };

  const serviceDate = input.serviceDate ?? '';
  const odometer = input.odometer ?? 0;
  const isSuperseded = input.records.some(
    (record) =>
      record.id !== input.excludeRecordId &&
      record.status !== 'draft' &&
      record.category === input.category &&
      (record.odometer > odometer || record.serviceDate.slice(0, 10) > serviceDate),
  );
  if (isSuperseded) return { kind: 'superseded' };

  const dateReached = !due.date || due.date <= input.today;
  const kmReached =
    due.odometer === undefined ||
    (input.currentOdometer !== undefined && due.odometer <= input.currentOdometer);
  if (dateReached && kmReached) return { kind: 'passed' };

  return { kind: 'due', due };
}

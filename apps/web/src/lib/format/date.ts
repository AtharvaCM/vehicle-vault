import { EMPTY } from './empty';

export type DateInput = Date | string | number | null | undefined;

/**
 * India Standard Time is UTC+05:30 all year (no daylight saving), so shifting
 * an instant by a fixed offset and reading its UTC fields gives the calendar
 * day and clock time an owner in India sees, whatever zone the browser or the
 * CI runner is in.
 *
 * Date-only values (a service date, a policy's end date) arrive as UTC
 * midnight, which is 05:30 the same day in India, so they keep their day.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The value as a `Date`, or null when it is missing or not a date at all. */
export function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const parsed = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type IndianParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hours: number;
  minutes: number;
};

function indianParts(date: Date): IndianParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

/** Days since the epoch of the Indian calendar day the instant falls on. */
function indianDayNumber(date: Date) {
  return Math.floor((date.getTime() + IST_OFFSET_MS) / MS_PER_DAY);
}

function clock({ hours, minutes }: IndianParts) {
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

export type DateStyle =
  /** "23 Sep 2026" — the one date style. */
  | 'medium'
  /** "Wed 23 Sep" — for dates close enough that the year goes without saying. */
  | 'short'
  /** "23 Sep" */
  | 'dayMonth'
  /** "Sep 2026" */
  | 'monthYear'
  /** "September 2026" */
  | 'monthYearLong'
  /** "Wednesday, 23 September 2026" — tooltips and screen-reader labels. */
  | 'long'
  /** "23 Sep 2026, 4:05 pm" — when something happened, not when it is due. */
  | 'dateTime';

/** A calendar date as India reads it, or "—" when there is none. Never "Invalid date". */
export function date(value: DateInput, style: DateStyle = 'medium') {
  const parsed = toValidDate(value);

  if (!parsed) return EMPTY;

  const parts = indianParts(parsed);
  const { year, month, day, weekday } = parts;

  switch (style) {
    case 'short':
      return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month]}`;
    case 'dayMonth':
      return `${day} ${MONTHS[month]}`;
    case 'monthYear':
      return `${MONTHS[month]} ${year}`;
    case 'monthYearLong':
      return `${MONTHS_LONG[month]} ${year}`;
    case 'long':
      return `${WEEKDAYS_LONG[weekday]}, ${day} ${MONTHS_LONG[month]} ${year}`;
    case 'dateTime':
      return `${day} ${MONTHS[month]} ${year}, ${clock(parts)}`;
    case 'medium':
      return `${day} ${MONTHS[month]} ${year}`;
  }
}

/**
 * Whole Indian calendar days from `now` to `target`: 0 on the day itself,
 * negative once it has passed, null when `target` is not a date.
 */
export function daysUntil(target: DateInput, now: Date = new Date()): number | null {
  const parsed = toValidDate(target);

  if (!parsed) return null;

  return indianDayNumber(parsed) - indianDayNumber(now);
}

/** "23 Sep", with the year added only when it is not this year. */
export function dayMonthInContext(value: Date, now: Date) {
  return indianParts(value).year === indianParts(now).year
    ? date(value, 'dayMonth')
    : date(value, 'medium');
}

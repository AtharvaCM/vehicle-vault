/**
 * The one place the web turns values into words: money, distances, dates,
 * due times and enum labels. Import `format` and call `format.money(…)`;
 * lint rejects `toLocaleString`, `toLocaleDateString`, `Intl` formatters and
 * date-fns `format` anywhere else in `src`.
 */
import { date, daysUntil } from './date';
import { EMPTY } from './empty';
import { enumLabel, enumOptions } from './enum-label';
import { distance, money, number, odometer } from './number';
import { relativeDue } from './relative-due';

export const format = {
  money,
  number,
  distance,
  odometer,
  date,
  relativeDue,
  enumLabel,
  enumOptions,
  daysUntil,
  EMPTY,
};

export type { DateInput, DateStyle } from './date';
export type { EnumKind, EnumValue } from './enum-label';
export type { MoneyOptions, NumberOptions } from './number';
export type { RelativeDueOptions } from './relative-due';

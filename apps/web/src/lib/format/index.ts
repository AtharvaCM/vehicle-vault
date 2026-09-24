/**
 * The one place the web turns values into words: money, distances, dates,
 * due times, registrations and enum labels. Import `format` and call `format.money(…)`;
 * lint rejects `toLocaleString`, `toLocaleDateString`, `Intl` formatters and
 * date-fns `format` anywhere else in `src`.
 */
import { date, daysUntil } from './date';
import { EMPTY } from './empty';
import { enumLabel, enumOptions } from './enum-label';
import { compactMoney, distance, money, number, odometer } from './number';
import { registration, spokenRegistration } from './registration';
import { relativeDue } from './relative-due';

export const format = {
  money,
  compactMoney,
  number,
  distance,
  odometer,
  date,
  relativeDue,
  registration,
  spokenRegistration,
  enumLabel,
  enumOptions,
  daysUntil,
  EMPTY,
};

export type { DateInput, DateStyle } from './date';
export type { EnumKind, EnumValue } from './enum-label';
export type { MoneyOptions, NumberOptions } from './number';
export type { RelativeDueOptions } from './relative-due';
export { parseRegistration } from './registration';
export type { RegistrationParts } from './registration';

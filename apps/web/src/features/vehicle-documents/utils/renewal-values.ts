import type { VehicleDocument } from '@vehicle-vault/shared';
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  isSameDay,
} from 'date-fns';

/** What the document form prefills with; the same shape a scan fills in. */
export type RenewalValues = {
  provider?: string;
  startDate: string;
  endDate: string;
  notes?: string;
  policyNumber?: string;
  premiumAmount?: number;
  insuredValue?: number;
  warrantyNumber?: string;
  type?: string;
  endOdometer?: number;
  number?: string;
  amount?: number;
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const numberOrUndefined = (value: unknown) => (typeof value === 'number' ? value : undefined);

/**
 * A document can be renewed once it has an expiry that has passed or is within
 * a month. One with no expiry, lifetime road tax say, never needs renewing.
 */
export function isRenewable(document: VehicleDocument, today = new Date()): boolean {
  if (!document.endDate) return false;
  return differenceInCalendarDays(new Date(document.endDate), today) <= 30;
}

/**
 * When the next term ends. Documents run in whole months or years (a six-month
 * PUC, a one-year policy), and months differ in length, so a term that was a
 * whole number of months is carried over in months; counting days would make
 * 1 Dec to 31 May renew as 1 Jun to 29 Nov. Anything else keeps its day count,
 * and a record with no start date is taken to have run a year.
 */
function nextTermEnd(oldStart: Date | null, oldEnd: Date, newStart: Date): Date {
  if (!oldStart) return addYears(oldEnd, 1);

  const dayAfterOldEnd = addDays(oldEnd, 1);
  const months = differenceInCalendarMonths(dayAfterOldEnd, oldStart);
  if (months > 0 && isSameDay(addMonths(oldStart, months), dayAfterOldEnd)) {
    return addDays(addMonths(newStart, months), -1);
  }

  const termDays = differenceInCalendarDays(oldEnd, oldStart);
  return termDays > 0 ? addDays(newStart, termDays) : addYears(oldEnd, 1);
}

/**
 * The next term of an expiring document: everything the old record holds, with
 * fresh dates. The new term starts the day after the old one ends, which is
 * how a renewed policy runs on without a gap, and lasts as long as the old
 * term did. The old record is left as it was: it is history, and the renewal
 * simply outranks it.
 */
export function renewalValues(document: VehicleDocument): RenewalValues {
  const oldEnd = new Date(document.endDate ?? new Date());
  const startDate = addDays(oldEnd, 1);
  const endDate = nextTermEnd(
    document.startDate ? new Date(document.startDate) : null,
    oldEnd,
    startDate,
  );

  const details = document.details ?? {};
  const number = document.number ?? undefined;

  return {
    provider: document.provider ?? undefined,
    startDate: toDateInput(startDate),
    endDate: toDateInput(endDate),
    ...(document.kind === 'insurance'
      ? {
          policyNumber: number,
          premiumAmount: numberOrUndefined(details.premiumAmount),
          insuredValue: numberOrUndefined(details.insuredValue),
        }
      : document.kind === 'warranty'
        ? {
            warrantyNumber: number,
            type: typeof details.type === 'string' ? details.type : undefined,
          }
        : { number, amount: numberOrUndefined(details.amount) }),
  };
}

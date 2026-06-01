import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);
const TWELVE = new Prisma.Decimal(12);

export interface Prepayment {
  date: Date;
  amount: Prisma.Decimal;
}

export interface LoanParams {
  principal: Prisma.Decimal;
  // Annual nominal rate as percent (e.g. 8.75 for 8.75%/yr).
  interestRate: Prisma.Decimal;
  tenureMonths: number;
  startDate: Date;
  prepayments?: Prepayment[];
  // When set with a date <= the natural end date, the loan is closed
  // early; any outstanding balance at that date is treated as paid in
  // full (foreclosure lump-sum). No EMIs accrue past this date.
  closedAt?: Date | null;
}

export interface AmortizationMonth {
  index: number;
  date: Date;
  emi: Prisma.Decimal;
  principal: Prisma.Decimal;
  interest: Prisma.Decimal;
  prepayment: Prisma.Decimal;
  balance: Prisma.Decimal;
}

export function monthlyRate(annualPercent: Prisma.Decimal): Prisma.Decimal {
  return annualPercent.div(HUNDRED).div(TWELVE);
}

export function computeEmi(params: {
  principal: Prisma.Decimal;
  interestRate: Prisma.Decimal;
  tenureMonths: number;
}): Prisma.Decimal {
  const r = monthlyRate(params.interestRate);
  if (params.tenureMonths <= 0) return ZERO;
  if (r.isZero()) {
    return params.principal.div(params.tenureMonths);
  }
  const onePlusR = r.plus(1);
  const pow = decimalPow(onePlusR, params.tenureMonths);
  return params.principal.mul(r).mul(pow).div(pow.minus(1));
}

/**
 * Builds an amortization schedule that respects prepayments (reducing
 * remaining principal at the month they fall in) and foreclosure
 * (truncates schedule at `closedAt` with zero outstanding).
 *
 * Prepayment strategy: keep EMI fixed, shorten tenure — the common
 * default for vehicle loans in IN.
 *
 * The schedule may exceed `tenureMonths` only when prepayments are
 * absent — once balance reaches zero, no further rows are emitted.
 */
export function buildSchedule(params: LoanParams): AmortizationMonth[] {
  const r = monthlyRate(params.interestRate);
  const emi = computeEmi(params);
  const schedule: AmortizationMonth[] = [];
  let balance = params.principal;
  const prepayments = (params.prepayments ?? []).slice().sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  let prepaymentCursor = 0;

  for (let i = 0; i < params.tenureMonths; i += 1) {
    if (balance.lessThanOrEqualTo(0)) break;
    const date = addMonths(params.startDate, i + 1);
    if (params.closedAt && date.getTime() > params.closedAt.getTime()) break;

    const interest = balance.mul(r);
    let principalPaid = emi.minus(interest);
    if (principalPaid.greaterThan(balance)) principalPaid = balance;
    if (principalPaid.lessThan(0)) principalPaid = ZERO;
    balance = balance.minus(principalPaid);

    // Apply prepayments whose date falls within or before this scheduled
    // EMI date (and after the previous one).
    let prepaymentTotal = ZERO;
    while (
      prepaymentCursor < prepayments.length &&
      prepayments[prepaymentCursor]!.date.getTime() <= date.getTime()
    ) {
      const prep = prepayments[prepaymentCursor]!;
      let prepAmount = prep.amount;
      if (prepAmount.greaterThan(balance)) prepAmount = balance;
      balance = balance.minus(prepAmount);
      prepaymentTotal = prepaymentTotal.plus(prepAmount);
      prepaymentCursor += 1;
      if (balance.lessThanOrEqualTo(0)) {
        balance = ZERO;
        break;
      }
    }

    schedule.push({
      index: i,
      date,
      emi,
      principal: principalPaid,
      interest,
      prepayment: prepaymentTotal,
      balance: balance.lessThan(0) ? ZERO : balance,
    });

    if (balance.lessThanOrEqualTo(0)) break;
  }

  return schedule;
}

export interface LoanSummary {
  emi: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  totalInterest: Prisma.Decimal;
  endDate: Date;
  monthsElapsed: number;
  monthsRemaining: number;
  outstandingBalance: Prisma.Decimal;
  interestPaidToDate: Prisma.Decimal;
  principalPaidToDate: Prisma.Decimal;
  prepaidToDate: Prisma.Decimal;
}

export function summarize(params: LoanParams, asOf: Date = new Date()): LoanSummary {
  const schedule = buildSchedule(params);
  const emi = schedule[0]?.emi ?? computeEmi(params);

  let interestPaid = ZERO;
  let principalPaid = ZERO;
  let prepaid = ZERO;
  let lastRow: AmortizationMonth | undefined;
  let elapsed = 0;

  for (const row of schedule) {
    if (row.date.getTime() > asOf.getTime()) break;
    interestPaid = interestPaid.plus(row.interest);
    principalPaid = principalPaid.plus(row.principal);
    prepaid = prepaid.plus(row.prepayment);
    lastRow = row;
    elapsed = row.index + 1;
  }

  // Foreclosure: any outstanding at closedAt counts as paid in full;
  // interest beyond closedAt is excluded.
  let outstanding = lastRow
    ? lastRow.balance
    : params.principal;
  if (params.closedAt && params.closedAt.getTime() <= asOf.getTime()) {
    outstanding = ZERO;
  }

  // Project remaining months from current state.
  const remainingSchedule = schedule.filter((row) => row.date.getTime() > asOf.getTime());
  const monthsRemaining = params.closedAt && params.closedAt.getTime() <= asOf.getTime()
    ? 0
    : remainingSchedule.length;

  const totalInterest = schedule.reduce((acc, row) => acc.plus(row.interest), ZERO);
  const totalPayable = totalInterest.plus(params.principal);

  // End date = last scheduled month (post-prepayments / foreclosure).
  const endDate = schedule.length
    ? schedule[schedule.length - 1]!.date
    : addMonths(params.startDate, params.tenureMonths);

  return {
    emi,
    totalPayable,
    totalInterest,
    endDate,
    monthsElapsed: elapsed,
    monthsRemaining,
    outstandingBalance: outstanding.lessThan(0) ? ZERO : outstanding,
    interestPaidToDate: interestPaid,
    principalPaidToDate: principalPaid,
    prepaidToDate: prepaid,
  };
}

/**
 * Returns `{ interest, principal }` accrued within [from, to] (inclusive
 * of months whose EMI date falls in the range). Honors prepayments and
 * foreclosure.
 */
export function accruedInRange(
  params: LoanParams,
  from: Date,
  to: Date,
): { interest: Prisma.Decimal; principal: Prisma.Decimal } {
  const schedule = buildSchedule(params);
  let interest = ZERO;
  let principal = ZERO;
  for (const row of schedule) {
    if (row.date.getTime() < from.getTime()) continue;
    if (row.date.getTime() > to.getTime()) break;
    interest = interest.plus(row.interest);
    principal = principal.plus(row.principal);
  }
  return { interest, principal };
}

function decimalPow(base: Prisma.Decimal, exp: number): Prisma.Decimal {
  let result = new Prisma.Decimal(1);
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = result.mul(b);
    b = b.mul(b);
    e = Math.floor(e / 2);
  }
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

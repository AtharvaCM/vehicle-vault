import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CostSplitResponse,
  CostTrendPoint,
  CostTrendResponse,
  TcoResponse,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { accruedInRange, summarize, type LoanParams } from '../vehicle-loans/amortization';

const DAY_MS = 24 * 60 * 60 * 1000;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function* monthsBetween(from: Date, to: Date): Generator<string> {
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    yield monthKey(cursor);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

function monthBoundsUtc(key: string): { start: Date; end: Date } {
  const parts = key.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

/**
 * Cost-split analytics over fuel, maintenance, and insurance.
 *
 * Insurance premium is pro-rated across the policy period — the portion
 * of `premiumAmount` whose days overlap with the requested range counts.
 *
 * Claims are netted into the maintenance bucket: when a claim is linked
 * to a maintenance record (1:1), the record's `totalCost` is already
 * counted, so we subtract `insurerPaidAmount` to reflect out-of-pocket.
 * Unlinked claims are ignored (they have no repair cost to discount).
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCostSplit(
    userId: string,
    options: { vehicleId?: string; from?: Date; to?: Date } = {},
  ): Promise<CostSplitResponse> {
    const now = new Date();
    const to = options.to ?? now;
    const from = options.from ?? new Date(to.getTime() - 365 * DAY_MS);

    if (options.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: options.vehicleId, userId },
        select: { id: true },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    const vehicleFilter = options.vehicleId
      ? { id: options.vehicleId, userId }
      : { userId };

    const [fuelAgg, maintenanceAgg, claimsAgg, policies, loans] = await Promise.all([
      this.prisma.fuelLog.aggregate({
        _sum: { totalCost: true },
        where: {
          date: { gte: from, lte: to },
          vehicle: vehicleFilter,
        },
      }),
      this.prisma.maintenanceRecord.aggregate({
        _sum: { totalCost: true },
        where: {
          serviceDate: { gte: from, lte: to },
          vehicle: vehicleFilter,
        },
      }),
      this.prisma.claim.aggregate({
        _sum: { insurerPaidAmount: true },
        where: {
          maintenanceRecordId: { not: null },
          maintenanceRecord: {
            serviceDate: { gte: from, lte: to },
            vehicle: vehicleFilter,
          },
        },
      }),
      this.prisma.insurancePolicy.findMany({
        where: {
          vehicle: vehicleFilter,
          startDate: { lte: to },
          endDate: { gte: from },
          premiumAmount: { not: null },
        },
        select: { startDate: true, endDate: true, premiumAmount: true },
      }),
      this.prisma.vehicleLoan.findMany({
        where: { vehicle: vehicleFilter, startDate: { lte: to } },
        select: {
          principal: true,
          interestRate: true,
          tenureMonths: true,
          startDate: true,
          closedAt: true,
          prepayments: { select: { date: true, amount: true } },
        },
      }),
    ]);

    const fuel = fuelAgg._sum.totalCost ?? new Prisma.Decimal(0);
    const maintenanceGross = maintenanceAgg._sum.totalCost ?? new Prisma.Decimal(0);
    const insurerPaid = claimsAgg._sum.insurerPaidAmount ?? new Prisma.Decimal(0);
    const maintenance = maintenanceGross.minus(insurerPaid);

    const insurance = policies.reduce((acc, p) => {
      if (!p.premiumAmount) return acc;
      const total = p.endDate.getTime() - p.startDate.getTime();
      if (total <= 0) return acc.plus(p.premiumAmount);
      const overlapStart = Math.max(p.startDate.getTime(), from.getTime());
      const overlapEnd = Math.min(p.endDate.getTime(), to.getTime());
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const ratio = overlap / total;
      return acc.plus(p.premiumAmount.mul(ratio));
    }, new Prisma.Decimal(0));

    const loanInterest = loans.reduce((acc, loan) => {
      const params: LoanParams = {
        principal: loan.principal,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        startDate: loan.startDate,
        prepayments: loan.prepayments,
        closedAt: loan.closedAt,
      };
      const { interest } = accruedInRange(params, from, to);
      return acc.plus(interest);
    }, new Prisma.Decimal(0));

    const total = fuel.plus(maintenance).plus(insurance).plus(loanInterest);

    return {
      currency: 'INR',
      range: { from: from.toISOString(), to: to.toISOString() },
      vehicleId: options.vehicleId,
      buckets: {
        fuel: fuel.toFixed(2),
        maintenance: maintenance.toFixed(2),
        insurance: insurance.toFixed(2),
        loanInterest: loanInterest.toFixed(2),
        total: total.toFixed(2),
      },
    };
  }

  /**
   * Monthly cost trend over the requested range.
   *
   * Per-month buckets contain fuel, maintenance (net of insurer-paid),
   * insurance (pro-rated across the month's overlap with each policy),
   * total cost, kilometres driven, and cost-per-km.
   *
   * Kilometres are derived from fuel-log odometer deltas, attributed to
   * the month of the later reading. Months with km=0 report
   * `costPerKm: null` to avoid divide-by-zero noise in charts.
   */
  async getCostTrend(
    userId: string,
    options: { vehicleId?: string; from?: Date; to?: Date } = {},
  ): Promise<CostTrendResponse> {
    const now = new Date();
    const to = options.to ?? now;
    const from = options.from ?? new Date(to.getTime() - 365 * DAY_MS);

    if (options.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: options.vehicleId, userId },
        select: { id: true },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    const vehicleFilter = options.vehicleId
      ? { id: options.vehicleId, userId }
      : { userId };

    const [fuelLogs, maintenanceRecords, claimRows, policies, loans] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where: { date: { gte: from, lte: to }, vehicle: vehicleFilter },
        select: { date: true, totalCost: true, odometer: true, vehicleId: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.maintenanceRecord.findMany({
        where: { serviceDate: { gte: from, lte: to }, vehicle: vehicleFilter },
        select: { id: true, serviceDate: true, totalCost: true },
      }),
      this.prisma.claim.findMany({
        where: {
          maintenanceRecordId: { not: null },
          maintenanceRecord: {
            serviceDate: { gte: from, lte: to },
            vehicle: vehicleFilter,
          },
        },
        select: {
          insurerPaidAmount: true,
          maintenanceRecord: { select: { serviceDate: true } },
        },
      }),
      this.prisma.insurancePolicy.findMany({
        where: {
          vehicle: vehicleFilter,
          startDate: { lte: to },
          endDate: { gte: from },
          premiumAmount: { not: null },
        },
        select: { startDate: true, endDate: true, premiumAmount: true },
      }),
      this.prisma.vehicleLoan.findMany({
        where: { vehicle: vehicleFilter, startDate: { lte: to } },
        select: {
          principal: true,
          interestRate: true,
          tenureMonths: true,
          startDate: true,
          closedAt: true,
          prepayments: { select: { date: true, amount: true } },
        },
      }),
    ]);

    type Bucket = {
      fuel: Prisma.Decimal;
      maintenance: Prisma.Decimal;
      insurerPaid: Prisma.Decimal;
      insurance: Prisma.Decimal;
      loanInterest: Prisma.Decimal;
      loanPrincipal: Prisma.Decimal;
      km: number;
    };
    const buckets = new Map<string, Bucket>();
    const ensure = (key: string): Bucket => {
      let b = buckets.get(key);
      if (!b) {
        b = {
          fuel: new Prisma.Decimal(0),
          maintenance: new Prisma.Decimal(0),
          insurerPaid: new Prisma.Decimal(0),
          insurance: new Prisma.Decimal(0),
          loanInterest: new Prisma.Decimal(0),
          loanPrincipal: new Prisma.Decimal(0),
          km: 0,
        };
        buckets.set(key, b);
      }
      return b;
    };

    // Seed every month in range so points form a continuous series.
    for (const key of monthsBetween(from, to)) ensure(key);

    // Fuel cost + odometer deltas (per vehicle, sorted asc).
    const logsByVehicle = new Map<string, typeof fuelLogs>();
    for (const log of fuelLogs) {
      const key = monthKey(log.date);
      ensure(key).fuel = ensure(key).fuel.plus(log.totalCost);
      const list = logsByVehicle.get(log.vehicleId) ?? [];
      list.push(log);
      logsByVehicle.set(log.vehicleId, list);
    }
    for (const logs of logsByVehicle.values()) {
      for (let i = 1; i < logs.length; i += 1) {
        const curr = logs[i];
        const prev = logs[i - 1];
        if (!curr || !prev) continue;
        const delta = curr.odometer - prev.odometer;
        if (delta > 0) {
          ensure(monthKey(curr.date)).km += delta;
        }
      }
    }

    // Maintenance gross.
    for (const record of maintenanceRecords) {
      const key = monthKey(record.serviceDate);
      ensure(key).maintenance = ensure(key).maintenance.plus(record.totalCost);
    }

    // Claim insurer-paid → subtracted from maintenance bucket.
    for (const row of claimRows) {
      if (!row.maintenanceRecord) continue;
      const key = monthKey(row.maintenanceRecord.serviceDate);
      ensure(key).insurerPaid = ensure(key).insurerPaid.plus(row.insurerPaidAmount);
    }

    // Loan interest + principal per scheduled EMI month.
    for (const loan of loans) {
      const params: LoanParams = {
        principal: loan.principal,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        startDate: loan.startDate,
        prepayments: loan.prepayments,
        closedAt: loan.closedAt,
      };
      for (const key of buckets.keys()) {
        const { start, end } = monthBoundsUtc(key);
        const overlapStart = new Date(Math.max(start.getTime(), from.getTime()));
        const overlapEnd = new Date(Math.min(end.getTime() - 1, to.getTime()));
        if (overlapEnd.getTime() < overlapStart.getTime()) continue;
        const { interest, principal } = accruedInRange(params, overlapStart, overlapEnd);
        const bucket = ensure(key);
        bucket.loanInterest = bucket.loanInterest.plus(interest);
        bucket.loanPrincipal = bucket.loanPrincipal.plus(principal);
      }
    }

    // Insurance pro-rated per month overlap.
    for (const p of policies) {
      if (!p.premiumAmount) continue;
      const total = p.endDate.getTime() - p.startDate.getTime();
      if (total <= 0) continue;
      for (const key of buckets.keys()) {
        const { start, end } = monthBoundsUtc(key);
        const overlapStart = Math.max(p.startDate.getTime(), start.getTime());
        const overlapEnd = Math.min(p.endDate.getTime(), end.getTime());
        const overlap = Math.max(0, overlapEnd - overlapStart);
        if (overlap === 0) continue;
        ensure(key).insurance = ensure(key).insurance.plus(p.premiumAmount.mul(overlap / total));
      }
    }

    const points: CostTrendPoint[] = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, b]) => {
        const maintenanceNet = b.maintenance.minus(b.insurerPaid);
        const total = b.fuel.plus(maintenanceNet).plus(b.insurance).plus(b.loanInterest);
        const costPerKm = b.km > 0 ? total.div(b.km).toFixed(2) : null;
        return {
          period,
          fuel: b.fuel.toFixed(2),
          maintenance: maintenanceNet.toFixed(2),
          insurance: b.insurance.toFixed(2),
          loanInterest: b.loanInterest.toFixed(2),
          loanPrincipal: b.loanPrincipal.toFixed(2),
          total: total.toFixed(2),
          km: b.km,
          costPerKm,
        };
      });

    return {
      currency: 'INR',
      granularity: 'month',
      range: { from: from.toISOString(), to: to.toISOString() },
      vehicleId: options.vehicleId,
      points,
    };
  }

  /**
   * Total cost of ownership for a single vehicle.
   *
   * Aggregates lifetime spend (no time window) across maintenance, fuel,
   * and insurance, subtracts insurer-paid amounts, then derives ₹/km and
   * ₹/month using the purchase metadata captured on the vehicle. When
   * `purchasePrice` is set, the TCO field includes it on top of the net
   * spend so the figure reflects "money out the door" for the asset.
   *
   * Falls back to fuel-log odometer range when `purchaseOdometer` isn't
   * recorded, so the card still computes ₹/km on existing vehicles.
   */
  async getTco(userId: string, vehicleId: string): Promise<TcoResponse> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [maintenanceAgg, fuelAgg, claimsAgg, policies, firstFuel, lastFuel, loans] = await Promise.all([
      this.prisma.maintenanceRecord.aggregate({
        _sum: { totalCost: true },
        where: { vehicleId },
      }),
      this.prisma.fuelLog.aggregate({
        _sum: { totalCost: true },
        where: { vehicleId },
      }),
      this.prisma.claim.aggregate({
        _sum: { insurerPaidAmount: true },
        where: { maintenanceRecord: { vehicleId } },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { vehicleId, premiumAmount: { not: null } },
        select: { premiumAmount: true },
      }),
      this.prisma.fuelLog.findFirst({
        where: { vehicleId },
        orderBy: { odometer: 'asc' },
        select: { odometer: true },
      }),
      this.prisma.fuelLog.findFirst({
        where: { vehicleId },
        orderBy: { odometer: 'desc' },
        select: { odometer: true },
      }),
      this.prisma.vehicleLoan.findMany({
        where: { vehicleId },
        select: {
          principal: true,
          interestRate: true,
          tenureMonths: true,
          startDate: true,
          closedAt: true,
          prepayments: { select: { date: true, amount: true } },
        },
      }),
    ]);

    const maintenance = maintenanceAgg._sum.totalCost ?? new Prisma.Decimal(0);
    const fuel = fuelAgg._sum.totalCost ?? new Prisma.Decimal(0);
    const insurerReimbursed = claimsAgg._sum.insurerPaidAmount ?? new Prisma.Decimal(0);
    const insurance = policies.reduce(
      (acc, p) => (p.premiumAmount ? acc.plus(p.premiumAmount) : acc),
      new Prisma.Decimal(0),
    );
    const loanTotals = loans.reduce(
      (acc, loan) => {
        const summary = summarize({
          principal: loan.principal,
          interestRate: loan.interestRate,
          tenureMonths: loan.tenureMonths,
          startDate: loan.startDate,
          prepayments: loan.prepayments,
          closedAt: loan.closedAt,
        });
        return {
          interestPaid: acc.interestPaid.plus(summary.interestPaidToDate),
          principalPaid: acc.principalPaid.plus(summary.principalPaidToDate),
          outstanding: acc.outstanding.plus(summary.outstandingBalance),
        };
      },
      {
        interestPaid: new Prisma.Decimal(0),
        principalPaid: new Prisma.Decimal(0),
        outstanding: new Prisma.Decimal(0),
      },
    );

    const netSpend = maintenance
      .plus(fuel)
      .plus(insurance)
      .plus(loanTotals.interestPaid)
      .minus(insurerReimbursed);
    const tco = vehicle.purchasePrice ? netSpend.plus(vehicle.purchasePrice) : null;

    let kmSincePurchase = 0;
    if (vehicle.purchaseOdometer != null) {
      kmSincePurchase = Math.max(0, vehicle.odometer - vehicle.purchaseOdometer);
    } else if (firstFuel && lastFuel) {
      kmSincePurchase = Math.max(0, lastFuel.odometer - firstFuel.odometer);
    }

    let ownershipMonths: number | null = null;
    if (vehicle.purchaseDate) {
      const now = new Date();
      const months =
        (now.getUTCFullYear() - vehicle.purchaseDate.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - vehicle.purchaseDate.getUTCMonth());
      ownershipMonths = Math.max(0, months);
    }

    const costPerKm =
      kmSincePurchase > 0 ? netSpend.div(kmSincePurchase).toFixed(2) : null;
    const costPerMonth =
      ownershipMonths && ownershipMonths > 0 ? netSpend.div(ownershipMonths).toFixed(2) : null;

    return {
      currency: 'INR',
      vehicleId,
      purchaseDate: vehicle.purchaseDate ? vehicle.purchaseDate.toISOString() : null,
      purchasePrice: vehicle.purchasePrice ? vehicle.purchasePrice.toFixed(2) : null,
      purchaseOdometer: vehicle.purchaseOdometer ?? null,
      ownershipMonths,
      kmSincePurchase,
      totals: {
        maintenance: maintenance.toFixed(2),
        fuel: fuel.toFixed(2),
        insurance: insurance.toFixed(2),
        insurerReimbursed: insurerReimbursed.toFixed(2),
        loanInterest: loanTotals.interestPaid.toFixed(2),
        loanPrincipalPaid: loanTotals.principalPaid.toFixed(2),
        loanOutstanding: loanTotals.outstanding.toFixed(2),
        netSpend: netSpend.toFixed(2),
        tco: tco ? tco.toFixed(2) : null,
      },
      derived: {
        costPerKm,
        costPerMonth,
      },
    };
  }
}

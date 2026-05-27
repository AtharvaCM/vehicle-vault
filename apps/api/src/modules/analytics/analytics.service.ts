import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CostSplitResponse } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

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

    const [fuelAgg, maintenanceAgg, claimsAgg, policies] = await Promise.all([
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

    const total = fuel.plus(maintenance).plus(insurance);

    return {
      currency: 'INR',
      range: { from: from.toISOString(), to: to.toISOString() },
      vehicleId: options.vehicleId,
      buckets: {
        fuel: fuel.toFixed(2),
        maintenance: maintenance.toFixed(2),
        insurance: insurance.toFixed(2),
        total: total.toFixed(2),
      },
    };
  }
}

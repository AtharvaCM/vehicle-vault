import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';

type Mock = ReturnType<typeof vi.fn>;

function makePrismaMock() {
  return {
    vehicle: { findFirst: vi.fn() },
    fuelLog: { aggregate: vi.fn() },
    maintenanceRecord: { aggregate: vi.fn() },
    claim: { aggregate: vi.fn() },
    insurancePolicy: { findMany: vi.fn() },
  };
}

describe('AnalyticsService.getCostSplit', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnalyticsService(prisma as never);
  });

  it('aggregates fuel + maintenance + insurance and nets claim insurer-paid', async () => {
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('1000.00') },
    });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('5000.00') },
    });
    (prisma.claim.aggregate as Mock).mockResolvedValue({
      _sum: { insurerPaidAmount: new Prisma.Decimal('2000.00') },
    });
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);

    const result = await service.getCostSplit('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result.buckets.fuel).toBe('1000.00');
    // 5000 - 2000 insurer paid
    expect(result.buckets.maintenance).toBe('3000.00');
    expect(result.buckets.insurance).toBe('0.00');
    expect(result.buckets.total).toBe('4000.00');
    expect(result.currency).toBe('INR');
  });

  it('pro-rates insurance premium across overlap with requested range', async () => {
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: null },
    });
    (prisma.claim.aggregate as Mock).mockResolvedValue({ _sum: { insurerPaidAmount: null } });

    // Policy: 1 year, 12000 premium → 1000/month.
    // Request range: exactly Jan → ~1/12 of premium counts.
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([
      {
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        premiumAmount: new Prisma.Decimal('12000.00'),
      },
    ]);

    const result = await service.getCostSplit('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
    });

    // 31 days out of 365 → ~1019.18
    expect(Number(result.buckets.insurance)).toBeGreaterThan(1000);
    expect(Number(result.buckets.insurance)).toBeLessThan(1100);
  });

  it('throws NotFound when vehicleId is not owned by user', async () => {
    (prisma.vehicle.findFirst as Mock).mockResolvedValue(null);

    await expect(
      service.getCostSplit('user-1', { vehicleId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

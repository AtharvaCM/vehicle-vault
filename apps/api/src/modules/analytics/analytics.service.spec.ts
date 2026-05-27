import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';

type Mock = ReturnType<typeof vi.fn>;

function makePrismaMock() {
  return {
    vehicle: { findFirst: vi.fn() },
    fuelLog: { aggregate: vi.fn(), findMany: vi.fn() },
    maintenanceRecord: { aggregate: vi.fn(), findMany: vi.fn() },
    claim: { aggregate: vi.fn(), findMany: vi.fn() },
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

describe('AnalyticsService.getCostTrend', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnalyticsService(prisma as never);
  });

  it('buckets fuel cost and km by month and computes cost-per-km', async () => {
    (prisma.fuelLog.findMany as Mock).mockResolvedValue([
      {
        date: new Date('2026-01-05T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('500.00'),
        odometer: 1000,
        vehicleId: 'v1',
      },
      {
        date: new Date('2026-01-20T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('600.00'),
        odometer: 1500, // +500km in Jan
        vehicleId: 'v1',
      },
      {
        date: new Date('2026-02-10T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('400.00'),
        odometer: 2000, // +500km in Feb
        vehicleId: 'v1',
      },
    ]);
    (prisma.maintenanceRecord.findMany as Mock).mockResolvedValue([]);
    (prisma.claim.findMany as Mock).mockResolvedValue([]);
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);

    const result = await service.getCostTrend('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-28T23:59:59.999Z'),
    });

    expect(result.granularity).toBe('month');
    expect(result.points).toHaveLength(2);
    const jan = result.points[0];
    const feb = result.points[1];
    expect(jan.period).toBe('2026-01');
    expect(jan.fuel).toBe('1100.00');
    expect(jan.km).toBe(500);
    // total / km = 1100/500 = 2.20
    expect(jan.costPerKm).toBe('2.20');
    expect(feb.period).toBe('2026-02');
    expect(feb.fuel).toBe('400.00');
    expect(feb.km).toBe(500);
    expect(feb.costPerKm).toBe('0.80');
  });

  it('nets insurer-paid out of monthly maintenance and reports null cost-per-km when km=0', async () => {
    (prisma.fuelLog.findMany as Mock).mockResolvedValue([]);
    (prisma.maintenanceRecord.findMany as Mock).mockResolvedValue([
      {
        id: 'm1',
        serviceDate: new Date('2026-01-15T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('5000.00'),
      },
    ]);
    (prisma.claim.findMany as Mock).mockResolvedValue([
      {
        insurerPaidAmount: new Prisma.Decimal('2000.00'),
        maintenanceRecord: { serviceDate: new Date('2026-01-15T00:00:00.000Z') },
      },
    ]);
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);

    const result = await service.getCostTrend('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result.points).toHaveLength(1);
    expect(result.points[0].maintenance).toBe('3000.00');
    expect(result.points[0].km).toBe(0);
    expect(result.points[0].costPerKm).toBeNull();
  });
});

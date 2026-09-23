import { Prisma } from '@prisma/client';
import { MaintenanceRecordStatus } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';

type Mock = ReturnType<typeof vi.fn>;

function makePrismaMock() {
  return {
    vehicle: { findFirst: vi.fn() },
    fuelLog: { aggregate: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    maintenanceRecord: { aggregate: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    claim: { aggregate: vi.fn(), findMany: vi.fn() },
    insurancePolicy: { findMany: vi.fn() },
    vehicleLoan: { findMany: vi.fn() },
    accessory: { aggregate: vi.fn(), findMany: vi.fn() },
    auditEvent: { findFirst: vi.fn() },
  };
}

/**
 * Accessories are a bucket every aggregation now reads, so default them to empty
 * in each suite. A test that cares about accessories overrides these.
 */
function stubEmptyAccessories(prisma: ReturnType<typeof makePrismaMock>) {
  (prisma.accessory.aggregate as Mock).mockResolvedValue({ _sum: { cost: null } });
  (prisma.accessory.findMany as Mock).mockResolvedValue([]);
}

describe('AnalyticsService.getCostSplit', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnalyticsService(prisma as never);
    stubEmptyAccessories(prisma);
    (prisma.vehicleLoan.findMany as Mock).mockResolvedValue([]);
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

  it('keeps accessory spend in its own bucket without touching maintenance', async () => {
    // The whole reason accessories are a separate table: a bought item must not
    // inflate the maintenance figure that per-km running cost is derived from.
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('5000.00') },
    });
    (prisma.claim.aggregate as Mock).mockResolvedValue({ _sum: { insurerPaidAmount: null } });
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    (prisma.accessory.aggregate as Mock).mockResolvedValue({
      _sum: { cost: new Prisma.Decimal('15000.00') },
    });

    const result = await service.getCostSplit('user-1', {});

    expect(result.buckets.accessories).toBe('15000.00');
    expect(result.buckets.maintenance).toBe('5000.00');
    expect(result.buckets.total).toBe('20000.00');
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
    stubEmptyAccessories(prisma);
    (prisma.vehicleLoan.findMany as Mock).mockResolvedValue([]);
  });

  it('buckets accessory spend into its purchase month and feeds cost-per-km', async () => {
    (prisma.fuelLog.findMany as Mock).mockResolvedValue([
      {
        date: new Date('2026-01-05T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('0.00'),
        odometer: 1000,
        vehicleId: 'v1',
      },
      {
        date: new Date('2026-01-20T00:00:00.000Z'),
        totalCost: new Prisma.Decimal('0.00'),
        odometer: 1500, // +500km in Jan
        vehicleId: 'v1',
      },
    ]);
    (prisma.maintenanceRecord.findMany as Mock).mockResolvedValue([]);
    (prisma.claim.findMany as Mock).mockResolvedValue([]);
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    (prisma.accessory.findMany as Mock).mockResolvedValue([
      { purchaseDate: new Date('2026-01-12T00:00:00.000Z'), cost: new Prisma.Decimal('5000.00') },
    ]);

    const result = await service.getCostTrend('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-28T23:59:59.999Z'),
    });

    const jan = result.points.find((point) => point.period === '2026-01');
    const feb = result.points.find((point) => point.period === '2026-02');

    expect(jan?.accessories).toBe('5000.00');
    expect(jan?.maintenance).toBe('0.00');
    expect(jan?.total).toBe('5000.00');
    expect(jan?.costPerKm).toBe('10.00'); // 5000 / 500km
    // A month with no accessories must still initialise the bucket, not blow up.
    expect(feb?.accessories).toBe('0.00');
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

describe('AnalyticsService.getTco', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnalyticsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnalyticsService(prisma as never);
    stubEmptyAccessories(prisma);
    (prisma.vehicleLoan.findMany as Mock).mockResolvedValue([]);
  });

  it('reports accessories separately and counts them in lifetime spend', async () => {
    (prisma.vehicle.findFirst as Mock).mockResolvedValue({
      id: 'v1',
      odometer: 10000,
      purchaseDate: null,
      purchasePrice: null,
      purchaseOdometer: 0,
    });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('40000.00') },
    });
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
    (prisma.claim.aggregate as Mock).mockResolvedValue({ _sum: { insurerPaidAmount: null } });
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    (prisma.fuelLog.findFirst as Mock).mockResolvedValue(null);
    (prisma.accessory.aggregate as Mock).mockResolvedValue({
      _sum: { cost: new Prisma.Decimal('15000.00') },
    });

    const result = await service.getTco('user-1', 'v1');

    expect(result.totals.accessories).toBe('15000.00');
    // Maintenance must not absorb the accessory spend — the separation is the point.
    expect(result.totals.maintenance).toBe('40000.00');
    expect(result.totals.netSpend).toBe('55000.00');
  });

  it('computes lifetime spend, TCO with purchase price, cost-per-km, and cost-per-month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T00:00:00.000Z'));

    (prisma.vehicle.findFirst as Mock).mockResolvedValue({
      id: 'v1',
      odometer: 20000,
      purchaseDate: new Date('2024-05-27T00:00:00.000Z'),
      purchasePrice: new Prisma.Decimal('800000.00'),
      purchaseOdometer: 0,
    });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('40000.00') },
    });
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('60000.00') },
    });
    (prisma.claim.aggregate as Mock).mockResolvedValue({
      _sum: { insurerPaidAmount: new Prisma.Decimal('5000.00') },
    });
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([
      { premiumAmount: new Prisma.Decimal('15000.00') },
      { premiumAmount: new Prisma.Decimal('15000.00') },
    ]);
    (prisma.fuelLog.findFirst as Mock).mockResolvedValue(null);

    const result = await service.getTco('user-1', 'v1');

    // net = 40000 + 60000 + 30000 - 5000 = 125000
    expect(result.totals.netSpend).toBe('125000.00');
    expect(result.totals.insurance).toBe('30000.00');
    expect(result.totals.tco).toBe('925000.00'); // + purchasePrice 800k
    expect(result.kmSincePurchase).toBe(20000);
    expect(result.ownershipMonths).toBe(24);
    // costPerKm = 125000/20000 = 6.25
    expect(result.derived.costPerKm).toBe('6.25');
    // costPerMonth = 125000/24 ≈ 5208.33
    expect(result.derived.costPerMonth).toBe('5208.33');

    vi.useRealTimers();
  });

  it('measures from the earliest fill to the current odometer when purchaseOdometer is missing', async () => {
    (prisma.vehicle.findFirst as Mock).mockResolvedValue({
      id: 'v1',
      odometer: 30000,
      purchaseDate: null,
      purchasePrice: null,
      purchaseOdometer: null,
    });
    (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({
      _sum: { totalCost: new Prisma.Decimal('10000.00') },
    });
    (prisma.claim.aggregate as Mock).mockResolvedValue({ _sum: { insurerPaidAmount: null } });
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    (prisma.fuelLog.findFirst as Mock)
      .mockResolvedValueOnce({ odometer: 5000 })
      .mockResolvedValueOnce({ odometer: 15000 });

    const result = await service.getTco('user-1', 'v1');

    // 30,000 on the vehicle less the 5,000 of the first fill, not the 10,000
    // between the two fills.
    expect(result.kmSincePurchase).toBe(25000);
    expect(result.totals.tco).toBeNull();
    expect(result.derived.costPerMonth).toBeNull();
    expect(result.derived.costPerKm).toBe('0.40');
  });

  describe('the distance ₹/km divides by', () => {
    const NET_SPEND = '28236.00';

    const stubSpend = (vehicle: { odometer: number; purchaseOdometer: number | null }) => {
      (prisma.vehicle.findFirst as Mock).mockResolvedValue({
        id: 'v1',
        purchaseDate: null,
        purchasePrice: null,
        ...vehicle,
      });
      (prisma.maintenanceRecord.aggregate as Mock).mockResolvedValue({
        _sum: { totalCost: new Prisma.Decimal(NET_SPEND) },
      });
      (prisma.fuelLog.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
      (prisma.claim.aggregate as Mock).mockResolvedValue({ _sum: { insurerPaidAmount: null } });
      (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    };

    /** Earliest then latest, as the service asks for them. */
    const stubFills = (first: number | null, last: number | null) =>
      (prisma.fuelLog.findFirst as Mock)
        .mockResolvedValueOnce(first == null ? null : { odometer: first })
        .mockResolvedValueOnce(last == null ? null : { odometer: last });
    const stubRecords = (first: number | null, last: number | null) =>
      (prisma.maintenanceRecord.findFirst as Mock)
        .mockResolvedValueOnce(first == null ? null : { odometer: first })
        .mockResolvedValueOnce(last == null ? null : { odometer: last });

    it('counts from the purchase odometer when there is one', async () => {
      stubSpend({ odometer: 18_500, purchaseOdometer: 15_000 });
      stubFills(17_800, 18_500);
      stubRecords(17_500, 17_500);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(3_500);
      expect(result.derived.costPerKm).toBe('8.07');
    });

    it('counts from the earliest service when it precedes every fill', async () => {
      stubSpend({ odometer: 26_000, purchaseOdometer: null });
      stubFills(24_800, 26_000);
      stubRecords(22_500, 25_000);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(3_500);
    });

    it('counts from the first fill when fills are all there is', async () => {
      stubSpend({ odometer: 21_000, purchaseOdometer: null });
      stubFills(18_000, 21_000);
      stubRecords(null, null);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(3_000);
      expect(result.derived.costPerKm).toBe('9.41');
    });

    it('counts from the odometer the vehicle was added with', async () => {
      stubSpend({ odometer: 20_000, purchaseOdometer: null });
      stubFills(18_700, 19_400);
      stubRecords(null, null);
      (prisma.auditEvent.findFirst as Mock).mockResolvedValue({ after: { odometer: 16_000 } });

      const result = await service.getTco('user-1', 'v1');

      expect(prisma.auditEvent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resourceId: 'v1', action: 'vehicle.created' }),
        }),
      );
      expect(result.kmSincePurchase).toBe(4_000);
    });

    it('reads up to a service logged past the vehicle’s own odometer', async () => {
      stubSpend({ odometer: 20_000, purchaseOdometer: 17_000 });
      stubFills(null, null);
      stubRecords(18_000, 20_400);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(3_400);
    });

    it('gives no figure over a distance too short to mean anything', async () => {
      // The demo Family SUV used to read "₹40 / km, 700 km": a year's insurance
      // and a service divided by the gap between two fills.
      stubSpend({ odometer: 18_200, purchaseOdometer: null });
      stubFills(17_800, 18_200);
      stubRecords(null, null);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(400);
      expect(result.derived.costPerKm).toBeNull();
    });

    it('gives no figure when the vehicle has no reading to measure from', async () => {
      stubSpend({ odometer: 18_200, purchaseOdometer: null });
      stubFills(null, null);
      stubRecords(null, null);

      const result = await service.getTco('user-1', 'v1');

      expect(result.kmSincePurchase).toBe(0);
      expect(result.derived.costPerKm).toBeNull();
    });
  });

  it('throws NotFound when vehicle is not owned', async () => {
    (prisma.vehicle.findFirst as Mock).mockResolvedValue(null);
    await expect(service.getTco('user-1', 'v-missing')).rejects.toMatchObject({ status: 404 });
  });
});

describe('AnalyticsService draft maintenance records', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: AnalyticsService;

  type Row = { totalCost: Prisma.Decimal; status?: MaintenanceRecordStatus };
  type ClaimRow = {
    insurerPaidAmount: Prisma.Decimal;
    serviceDate: Date;
    recordStatus?: MaintenanceRecordStatus;
  };

  /**
   * Resolves fixtures the way Prisma would: by applying the `status` the
   * service puts on its `where`. A plain `mockResolvedValue` hands back rows the
   * database was never asked for, so these assertions would still pass with the
   * draft filter deleted. A row without a `status` is confirmed, matching the
   * column default.
   */
  const visible = <T extends { status?: MaintenanceRecordStatus }>(
    rows: T[],
    wanted: string | undefined,
  ) =>
    wanted
      ? rows.filter((row) => (row.status ?? MaintenanceRecordStatus.Confirmed) === wanted)
      : rows;

  const sum = (values: Prisma.Decimal[]) =>
    values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0));

  const stubMaintenance = (rows: Row[]) => {
    const filter = (args: unknown) =>
      visible(rows, (args as { where?: { status?: string } }).where?.status);

    (prisma.maintenanceRecord.aggregate as Mock).mockImplementation((args: unknown) =>
      Promise.resolve({ _sum: { totalCost: sum(filter(args).map((row) => row.totalCost)) } }),
    );
    (prisma.maintenanceRecord.findMany as Mock).mockImplementation((args: unknown) =>
      Promise.resolve(
        filter(args).map((row, index) => ({
          id: `r${index}`,
          serviceDate: new Date('2026-01-15T00:00:00.000Z'),
          totalCost: row.totalCost,
        })),
      ),
    );
  };

  /** Claims reach maintenance through a nested `where`, so read the status there. */
  const stubClaims = (rows: ClaimRow[]) => {
    const filter = (args: unknown) =>
      visible(
        rows.map(({ recordStatus, ...rest }) => ({ ...rest, status: recordStatus })),
        (args as { where?: { maintenanceRecord?: { status?: string } } }).where?.maintenanceRecord
          ?.status,
      );

    (prisma.claim.aggregate as Mock).mockImplementation((args: unknown) =>
      Promise.resolve({
        _sum: { insurerPaidAmount: sum(filter(args).map((row) => row.insurerPaidAmount)) },
      }),
    );
    (prisma.claim.findMany as Mock).mockImplementation((args: unknown) =>
      Promise.resolve(
        filter(args).map((row) => ({
          insurerPaidAmount: row.insurerPaidAmount,
          maintenanceRecord: { serviceDate: row.serviceDate },
        })),
      ),
    );
  };

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AnalyticsService(prisma as never);
    stubEmptyAccessories(prisma);
    (prisma.vehicleLoan.findMany as Mock).mockResolvedValue([]);
    (prisma.insurancePolicy.findMany as Mock).mockResolvedValue([]);
    (prisma.fuelLog.aggregate as Mock).mockResolvedValue({ _sum: { totalCost: null } });
    (prisma.fuelLog.findMany as Mock).mockResolvedValue([]);
    (prisma.fuelLog.findFirst as Mock).mockResolvedValue(null);
    stubClaims([]);
  });

  it('keeps a scanned-but-unconfirmed invoice out of the cost split', async () => {
    // A receipt was scanned and applied: the extraction wrote ₹12 000 onto the
    // record but left it a draft, so nobody has agreed that money was spent.
    // Only the ₹5 000 service the owner actually logged is spend.
    stubMaintenance([
      { totalCost: new Prisma.Decimal('5000.00') },
      { totalCost: new Prisma.Decimal('12000.00'), status: MaintenanceRecordStatus.Draft },
    ]);

    const result = await service.getCostSplit('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result.buckets.maintenance).toBe('5000.00');
    expect(result.buckets.total).toBe('5000.00');
  });

  it('does not net a draft-linked claim payout against confirmed spend', async () => {
    // The half that would break if only the maintenance side were filtered: the
    // maintenance bucket is gross minus insurer-paid, so subtracting a payout
    // claimed against an excluded draft would report less than was spent.
    stubMaintenance([
      { totalCost: new Prisma.Decimal('5000.00') },
      { totalCost: new Prisma.Decimal('12000.00'), status: MaintenanceRecordStatus.Draft },
    ]);
    stubClaims([
      {
        insurerPaidAmount: new Prisma.Decimal('8000.00'),
        serviceDate: new Date('2026-01-15T00:00:00.000Z'),
        recordStatus: MaintenanceRecordStatus.Draft,
      },
    ]);

    const result = await service.getCostSplit('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    });

    // Not 5000 - 8000 = -3000.
    expect(result.buckets.maintenance).toBe('5000.00');
  });

  it('keeps a draft out of the monthly cost trend', async () => {
    stubMaintenance([
      { totalCost: new Prisma.Decimal('5000.00') },
      { totalCost: new Prisma.Decimal('12000.00'), status: MaintenanceRecordStatus.Draft },
    ]);

    const result = await service.getCostTrend('user-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-31T23:59:59.999Z'),
    });

    expect(result.points.find((point) => point.period === '2026-01')?.maintenance).toBe('5000.00');
  });

  it('keeps a draft out of lifetime spend and cost-per-km', async () => {
    // TCO is the figure an owner quotes about their vehicle, and ₹/km divides
    // straight through it — an unreviewed extraction would move both.
    (prisma.vehicle.findFirst as Mock).mockResolvedValue({
      id: 'v1',
      odometer: 10000,
      purchaseDate: null,
      purchasePrice: null,
      purchaseOdometer: 0,
    });
    stubMaintenance([
      { totalCost: new Prisma.Decimal('40000.00') },
      { totalCost: new Prisma.Decimal('12000.00'), status: MaintenanceRecordStatus.Draft },
    ]);

    const result = await service.getTco('user-1', 'v1');

    expect(result.totals.maintenance).toBe('40000.00');
    expect(result.totals.netSpend).toBe('40000.00');
    expect(result.derived.costPerKm).toBe('4.00');
  });
});

import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleInsightsService } from './vehicle-insights.service';

describe('VehicleInsightsService', () => {
  const prisma = {
    vehicle: { findUnique: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    fuelLog: { findMany: vi.fn() },
    vehicleCatalogVariantSpec: { findUnique: vi.fn() },
  };
  const access = { assert: vi.fn() };

  let service: VehicleInsightsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VehicleInsightsService(prisma as never, access as never);
  });

  it('throws when vehicle is missing', async () => {
    prisma.vehicle.findUnique.mockResolvedValueOnce(null);
    prisma.maintenanceRecord.findMany.mockResolvedValueOnce([]);
    prisma.fuelLog.findMany.mockResolvedValueOnce([]);
    await expect(service.getOdometerInsights('u', 'v')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ignores readings with odometer <= 0 so unknown placeholders do not poison predictions', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    // The vehicle reads what the latest service raised it to, so adds no reading of its own.
    prisma.vehicle.findUnique.mockResolvedValueOnce({
      odometer: 4000,
      createdAt,
      updatedAt: createdAt,
    });
    prisma.maintenanceRecord.findMany.mockResolvedValueOnce([
      { serviceDate: new Date('2026-02-01T00:00:00Z'), odometer: 2000 },
      { serviceDate: new Date('2026-03-01T00:00:00Z'), odometer: 4000 },
    ]);
    // Latest fuel log has odometer = 0 (user did not record it); must be skipped.
    prisma.fuelLog.findMany.mockResolvedValueOnce([
      { date: new Date('2026-06-20T00:00:00Z'), odometer: 0 },
    ]);

    const result = await service.getOdometerInsights('u', 'v');

    expect(result.lastRecordedOdometer).toBe(4000);
    expect(result.currentOdometerPredicted).toBeGreaterThanOrEqual(4000);
    expect(result.dataPointsCount).toBe(2);
  });

  it('falls back to the vehicle’s own odometer when no positive readings exist', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.vehicle.findUnique.mockResolvedValueOnce({
      odometer: 4540,
      createdAt,
      updatedAt: createdAt,
    });
    prisma.maintenanceRecord.findMany.mockResolvedValueOnce([]);
    prisma.fuelLog.findMany.mockResolvedValueOnce([
      { date: new Date('2026-06-20T00:00:00Z'), odometer: 0 },
    ]);

    const result = await service.getOdometerInsights('u', 'v');

    expect(result.lastRecordedOdometer).toBe(4540);
    expect(result.currentOdometerPredicted).toBe(4540);
    expect(result.dataPointsCount).toBe(1);
    expect(result.confidence).toBe('low');
  });
  describe('the odometer stored on the vehicle', () => {
    const NOW = new Date('2026-09-23T06:30:00Z');
    const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('never predicts below the reading the owner entered (the demo Daily Hatch)', async () => {
      // 32,000 typed on the vehicle 130 days ago; the only fill, 120 days ago,
      // read 31,800. The fill alone used to be the "prediction".
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        odometer: 32_000,
        createdAt: daysAgo(400),
        updatedAt: daysAgo(130),
      });
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([]);
      prisma.fuelLog.findMany.mockResolvedValueOnce([{ date: daysAgo(120), odometer: 31_800 }]);

      const result = await service.getOdometerInsights('u', 'v');

      expect(result.currentOdometerPredicted).toBe(32_000);
      expect(result.lastRecordedOdometer).toBe(32_000);
      expect(result.lastRecordedDate).toBe(daysAgo(130).toISOString());
      // Readings that go backwards measure no rate, rather than a negative one.
      expect(result.averageDailyMileage).toBe(0);
    });

    it('counts the stored odometer as the latest reading and predicts on from it', async () => {
      // 30,000 at a service 100 days ago, 31,000 at a fill 50 days ago, and
      // 31,500 typed on the vehicle 10 days ago: 15 km/day over 90 days.
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        odometer: 31_500,
        createdAt: daysAgo(400),
        updatedAt: daysAgo(10),
      });
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([
        { serviceDate: daysAgo(100), odometer: 30_000 },
      ]);
      prisma.fuelLog.findMany.mockResolvedValueOnce([{ date: daysAgo(50), odometer: 31_000 }]);

      const result = await service.getOdometerInsights('u', 'v');

      expect(result.dataPointsCount).toBe(3);
      expect(result.lastRecordedOdometer).toBe(31_500);
      expect(result.averageDailyMileage).toBeCloseTo(16.7, 1);
      expect(result.currentOdometerPredicted).toBe(Math.round(31_500 + 10 * (1_500 / 90)));
    });

    it('does not add the stored odometer again when a fill already raised it', async () => {
      // The fill bumped the vehicle to its own reading; dating that copy "now"
      // would invent 60 days of standing still and halve the rate.
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        odometer: 21_000,
        createdAt: daysAgo(400),
        updatedAt: daysAgo(1),
      });
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([
        { serviceDate: daysAgo(100), odometer: 20_000 },
      ]);
      prisma.fuelLog.findMany.mockResolvedValueOnce([{ date: daysAgo(60), odometer: 21_000 }]);

      const result = await service.getOdometerInsights('u', 'v');

      expect(result.dataPointsCount).toBe(2);
      expect(result.averageDailyMileage).toBe(25);
      expect(result.currentOdometerPredicted).toBe(21_000 + 60 * 25);
    });

    it('keeps the highest reading when a later entry reads lower', async () => {
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        odometer: 45_000,
        createdAt: daysAgo(400),
        updatedAt: daysAgo(200),
      });
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([
        { serviceDate: daysAgo(150), odometer: 43_000 },
      ]);
      prisma.fuelLog.findMany.mockResolvedValueOnce([{ date: daysAgo(30), odometer: 44_125 }]);

      const result = await service.getOdometerInsights('u', 'v');

      expect(result.currentOdometerPredicted).toBeGreaterThanOrEqual(45_000);
      expect(result.lastRecordedOdometer).toBe(45_000);
    });

    it('reports a single reading as it is, with no rate', async () => {
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        odometer: 12_000,
        createdAt: daysAgo(40),
        updatedAt: daysAgo(40),
      });
      prisma.maintenanceRecord.findMany.mockResolvedValueOnce([]);
      prisma.fuelLog.findMany.mockResolvedValueOnce([]);

      const result = await service.getOdometerInsights('u', 'v');

      expect(result).toMatchObject({
        currentOdometerPredicted: 12_000,
        lastRecordedOdometer: 12_000,
        averageDailyMileage: 0,
        averageMonthlyMileage: 0,
        dataPointsCount: 1,
      });
    });
  });

  describe('getFuelEconomy', () => {
    const fills = [
      { odometer: 15_000, quantity: 30, date: new Date('2026-09-01T00:00:00Z') },
      { odometer: 15_450, quantity: 30, date: new Date('2026-09-10T00:00:00Z') },
    ];

    it('sets the achieved figure beside the claim of the variant the vehicle is linked to', async () => {
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        fuelType: 'petrol',
        catalogVariantId: 'variant-1',
      });
      prisma.fuelLog.findMany.mockResolvedValueOnce(fills);
      prisma.vehicleCatalogVariantSpec.findUnique.mockResolvedValueOnce({ mileageCombined: 17.5 });

      const economy = await service.getFuelEconomy('u', 'v');

      expect(access.assert).toHaveBeenCalledWith('u', 'v');
      expect(prisma.vehicleCatalogVariantSpec.findUnique).toHaveBeenCalledWith({
        where: { variantId: 'variant-1' },
        select: { mileageCombined: true },
      });
      expect(economy).toMatchObject({
        unit: 'km/L',
        achieved: { value: 15 },
        claimed: 17.5,
        differencePercent: -14,
      });
    });

    it('selects only odometer, quantity and date: the P3 full-tank flag and payment method never reach the calculation', async () => {
      // Regression guard for the "log fuel" redesign, which added isFullTank and
      // paymentMethod to FuelLog. The economy figure must keep coming out exactly
      // as it did before those columns existed, for logs that predate them too.
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        fuelType: 'petrol',
        catalogVariantId: null,
      });
      prisma.fuelLog.findMany.mockResolvedValueOnce(fills);

      const economy = await service.getFuelEconomy('u', 'v');

      expect(prisma.fuelLog.findMany).toHaveBeenCalledWith({
        where: { vehicleId: 'v' },
        select: { odometer: true, quantity: true, date: true },
      });
      expect(economy.achieved).toEqual({ value: 15, distanceKm: 450, quantity: 30 });
    });

    it('shows the achieved figure alone for a vehicle with no catalog link', async () => {
      prisma.vehicle.findUnique.mockResolvedValueOnce({
        fuelType: 'petrol',
        catalogVariantId: null,
      });
      prisma.fuelLog.findMany.mockResolvedValueOnce(fills);

      const economy = await service.getFuelEconomy('u', 'v');

      expect(prisma.vehicleCatalogVariantSpec.findUnique).not.toHaveBeenCalled();
      expect(economy).toMatchObject({ achieved: { value: 15 }, claimed: null });
    });

    it('throws when the vehicle is missing', async () => {
      prisma.vehicle.findUnique.mockResolvedValueOnce(null);

      await expect(service.getFuelEconomy('u', 'v')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

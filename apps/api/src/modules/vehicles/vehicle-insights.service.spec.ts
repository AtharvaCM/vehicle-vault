import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    prisma.vehicle.findUnique.mockResolvedValueOnce({ odometer: 4540, createdAt });
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

  it('falls back to the vehicle baseline when no positive readings exist', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.vehicle.findUnique.mockResolvedValueOnce({ odometer: 4540, createdAt });
    prisma.maintenanceRecord.findMany.mockResolvedValueOnce([]);
    prisma.fuelLog.findMany.mockResolvedValueOnce([
      { date: new Date('2026-06-20T00:00:00Z'), odometer: 0 },
    ]);

    const result = await service.getOdometerInsights('u', 'v');

    expect(result.lastRecordedOdometer).toBe(4540);
    expect(result.currentOdometerPredicted).toBe(4540);
    expect(result.dataPointsCount).toBe(0);
    expect(result.confidence).toBe('low');
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

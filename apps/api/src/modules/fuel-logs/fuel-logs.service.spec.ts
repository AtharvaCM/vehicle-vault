import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FuelLogsService } from './fuel-logs.service';

describe('FuelLogsService first_fuel_logged', () => {
  const at = new Date('2026-09-18T00:00:00.000Z');
  const row = {
    id: 'fuel-1',
    vehicleId: 'vehicle-1',
    date: at,
    odometer: 18_600,
    quantity: 32.5,
    price: new Prisma.Decimal(104.2),
    totalCost: new Prisma.Decimal(3386.5),
    location: null,
    notes: null,
    createdAt: at,
    updatedAt: at,
  };

  /** The transaction client the callback receives — what the event must be written through. */
  const tx = {
    fuelLog: { create: vi.fn() },
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = { $transaction: vi.fn() };
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };

  const dto = {
    date: '2026-09-18T00:00:00.000Z',
    odometer: 18_600,
    quantity: 32.5,
    price: 104.2,
    totalCost: 3386.5,
  };

  let service: FuelLogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    );
    tx.fuelLog.create.mockResolvedValue(row);
    tx.vehicle.findUnique.mockResolvedValue({ odometer: 18_000 });
    service = new FuelLogsService(
      prisma as never,
      {} as never,
      { track: vi.fn().mockResolvedValue(undefined) } as never,
      { assertEditor: vi.fn() } as never,
      productEvents as never,
    );
  });

  it('is recorded inside the transaction that saves a fuel log', async () => {
    await service.createFuelLog('user-1', 'vehicle-1', dto);

    expect(productEvents.recordFirst).toHaveBeenCalledWith(tx, {
      name: 'first_fuel_logged',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('is recorded once for a bulk import, not once per imported row', async () => {
    const result = await service.createBulkFuelLogs('user-1', 'vehicle-1', [dto, dto, dto]);

    expect(result).toEqual({ count: 3 });
    expect(productEvents.recordFirst).toHaveBeenCalledTimes(1);
    expect(productEvents.recordFirst).toHaveBeenCalledWith(tx, {
      name: 'first_fuel_logged',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('is not recorded when a bulk import saves nothing', async () => {
    await service.createBulkFuelLogs('user-1', 'vehicle-1', []);

    expect(productEvents.recordFirst).not.toHaveBeenCalled();
  });
});

import type { Warranty } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WarrantyAdapter } from './warranty.adapter';

const baseRow: Warranty = {
  id: 'wty-1',
  vehicleId: 'veh-1',
  provider: 'OEM Manufacturer',
  warrantyNumber: 'WTY-99',
  type: 'manufacturer',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2029-01-01T00:00:00.000Z'),
  endOdometer: 100000,
  notes: 'transferable',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('WarrantyAdapter', () => {
  const prisma = {
    warranty: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  let adapter: WarrantyAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new WarrantyAdapter(prisma as never);
  });

  describe('toDocument', () => {
    it('maps a Warranty row to the unified VehicleDocument shape', () => {
      expect(adapter.toDocument(baseRow)).toEqual({
        id: 'wty-1',
        vehicleId: 'veh-1',
        kind: 'warranty',
        provider: 'OEM Manufacturer',
        number: 'WTY-99',
        startDate: baseRow.startDate,
        endDate: baseRow.endDate,
        notes: 'transferable',
        details: { type: 'manufacturer', endOdometer: 100000 },
        createdAt: baseRow.createdAt,
        updatedAt: baseRow.updatedAt,
      });
    });

    it('preserves nullable endDate and warrantyNumber in the unified shape', () => {
      expect(
        adapter.toDocument({ ...baseRow, endDate: null, warrantyNumber: null }),
      ).toMatchObject({
        endDate: null,
        number: null,
      });
    });
  });

  describe('activeAt', () => {
    it('queries warranties that have started and either have no end date or end after the date', async () => {
      prisma.warranty.findMany.mockResolvedValue([baseRow]);
      const date = new Date('2026-06-15T00:00:00.000Z');

      const result = await adapter.activeAt('veh-1', date);

      expect(prisma.warranty.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'veh-1',
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
        },
        orderBy: { startDate: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe('warranty');
    });
  });

  describe('findExpiringBetween', () => {
    it('scopes to the user and excludes warranties with a null endDate', async () => {
      prisma.warranty.findMany.mockResolvedValue([baseRow]);
      const from = new Date('2026-05-16T00:00:00.000Z');
      const until = new Date('2026-05-23T23:59:59.999Z');

      const result = await adapter.findExpiringBetween('user-1', from, until);

      // The OR-on-null guard from activeAt is intentionally absent — a warranty
      // with no end date never expires and should not produce an alert.
      expect(prisma.warranty.findMany).toHaveBeenCalledWith({
        where: {
          vehicle: { userId: 'user-1' },
          endDate: { gte: from, lte: until },
        },
        orderBy: { endDate: 'asc' },
      });
      expect(result[0]?.kind).toBe('warranty');
    });
  });

  describe('create', () => {
    it('writes the prisma row with vehicleId scope and nullish fallbacks', async () => {
      prisma.warranty.create.mockResolvedValue(baseRow);

      await adapter.create('veh-1', {
        kind: 'warranty',
        provider: 'OEM Manufacturer',
        warrantyNumber: undefined,
        type: 'manufacturer',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: undefined,
        endOdometer: null,
        notes: undefined,
      });

      expect(prisma.warranty.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 'veh-1',
          provider: 'OEM Manufacturer',
          warrantyNumber: null,
          type: 'manufacturer',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: null,
          endOdometer: null,
          notes: null,
        },
      });
    });
  });
});

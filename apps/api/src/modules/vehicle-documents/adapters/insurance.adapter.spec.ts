import type { InsurancePolicy, Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsuranceAdapter } from './insurance.adapter';

const baseRow: InsurancePolicy = {
  id: 'pol-1',
  vehicleId: 'veh-1',
  provider: 'Acme Insurance',
  policyNumber: 'POL-001',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2027-01-01T00:00:00.000Z'),
  premiumAmount: { toFixed: () => '12500.00' } as unknown as Prisma.Decimal,
  insuredValue: { toFixed: () => '500000.00' } as unknown as Prisma.Decimal,
  notes: 'preferred provider',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// Build a row where the Decimal-shaped fields round-trip through Number(...) cleanly.
function rowWithDecimals(): InsurancePolicy {
  return {
    ...baseRow,
    premiumAmount: 12500 as unknown as Prisma.Decimal,
    insuredValue: 500000 as unknown as Prisma.Decimal,
  };
}

describe('InsuranceAdapter', () => {
  const prisma = {
    insurancePolicy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  let adapter: InsuranceAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new InsuranceAdapter(prisma as never);
  });

  describe('toDocument', () => {
    it('maps an InsurancePolicy row to the unified VehicleDocument shape', () => {
      const doc = adapter.toDocument(rowWithDecimals());
      expect(doc).toEqual({
        id: 'pol-1',
        vehicleId: 'veh-1',
        kind: 'insurance',
        provider: 'Acme Insurance',
        number: 'POL-001',
        startDate: rowWithDecimals().startDate,
        endDate: rowWithDecimals().endDate,
        notes: 'preferred provider',
        details: {
          premiumAmount: 12500,
          insuredValue: 500000,
        },
        createdAt: rowWithDecimals().createdAt,
        updatedAt: rowWithDecimals().updatedAt,
      });
    });

    it('converts null Decimal fields to null in details', () => {
      const doc = adapter.toDocument({
        ...rowWithDecimals(),
        premiumAmount: null,
        insuredValue: null,
      });
      expect(doc.details).toEqual({ premiumAmount: null, insuredValue: null });
    });
  });

  describe('create', () => {
    it('writes the prisma row with vehicleId scope and nullish fallbacks', async () => {
      prisma.insurancePolicy.create.mockResolvedValue(rowWithDecimals());

      await adapter.create('veh-1', {
        kind: 'insurance',
        provider: 'Acme Insurance',
        policyNumber: 'POL-001',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
        premiumAmount: undefined,
        insuredValue: null,
        notes: undefined,
      });

      expect(prisma.insurancePolicy.create).toHaveBeenCalledWith({
        data: {
          vehicleId: 'veh-1',
          provider: 'Acme Insurance',
          policyNumber: 'POL-001',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2027-01-01T00:00:00.000Z'),
          premiumAmount: null,
          insuredValue: null,
          notes: null,
        },
      });
    });
  });

  describe('activeAt', () => {
    it('queries policies whose validity window contains the given date', async () => {
      prisma.insurancePolicy.findMany.mockResolvedValue([rowWithDecimals()]);
      const date = new Date('2026-06-15T00:00:00.000Z');

      const result = await adapter.activeAt('veh-1', date);

      expect(prisma.insurancePolicy.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'veh-1',
          startDate: { lte: date },
          endDate: { gte: date },
        },
        orderBy: { endDate: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe('insurance');
    });
  });

  describe('findForOwnerCheck', () => {
    it('returns the document and the owning user id', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({
        ...rowWithDecimals(),
        vehicle: { userId: 'user-1' },
      });

      const result = await adapter.findForOwnerCheck('pol-1');

      expect(prisma.insurancePolicy.findUnique).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        include: { vehicle: { select: { userId: true } } },
      });
      expect(result?.vehicleUserId).toBe('user-1');
      expect(result?.document.kind).toBe('insurance');
    });

    it('returns null when no row matches', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue(null);
      await expect(adapter.findForOwnerCheck('missing')).resolves.toBeNull();
    });
  });
});

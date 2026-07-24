import { Prisma, type ComplianceDocument } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PucAdapter, RegistrationAdapter, RoadTaxAdapter } from './compliance.adapter';

const baseRow: ComplianceDocument = {
  id: 'cmp-1',
  vehicleId: 'veh-1',
  kind: 'puc',
  provider: 'Authorized PUC Center, Pune',
  number: 'PUC-2026-1234',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-07-01T00:00:00.000Z'),
  amount: new Prisma.Decimal('150.00'),
  notes: 'CNG retest due next cycle',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ComplianceAdapter', () => {
  const prisma = {
    complianceDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  let adapter: PucAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PucAdapter(prisma as never);
  });

  describe('toDocument', () => {
    it('maps a ComplianceDocument row to the unified VehicleDocument shape', () => {
      expect(adapter.toDocument(baseRow)).toEqual({
        id: 'cmp-1',
        vehicleId: 'veh-1',
        kind: 'puc',
        provider: 'Authorized PUC Center, Pune',
        number: 'PUC-2026-1234',
        startDate: baseRow.startDate,
        endDate: baseRow.endDate,
        notes: 'CNG retest due next cycle',
        details: { amount: 150 },
        createdAt: baseRow.createdAt,
        updatedAt: baseRow.updatedAt,
      });
    });

    it('preserves nullable endDate, number, and amount', () => {
      expect(
        adapter.toDocument({ ...baseRow, endDate: null, number: null, amount: null }),
      ).toMatchObject({
        endDate: null,
        number: null,
        details: { amount: null },
      });
    });
  });

  it('each subclass carries its own kind literal', () => {
    expect(new RegistrationAdapter(prisma as never).kind).toBe('registration');
    expect(new PucAdapter(prisma as never).kind).toBe('puc');
    expect(new RoadTaxAdapter(prisma as never).kind).toBe('road_tax');
  });

  it('scopes listForVehicle to its own kind', async () => {
    prisma.complianceDocument.findMany.mockResolvedValue([baseRow]);
    await adapter.listForVehicle('veh-1');
    expect(prisma.complianceDocument.findMany).toHaveBeenCalledWith({
      where: { vehicleId: 'veh-1', kind: 'puc' },
      orderBy: { startDate: 'desc' },
    });
  });

  it('findForOwnerCheck rejects a row of a different kind', async () => {
    prisma.complianceDocument.findUnique.mockResolvedValue({
      ...baseRow,
      kind: 'road_tax',
      vehicle: { userId: 'user-1' },
    });
    expect(await adapter.findForOwnerCheck('cmp-1')).toBeNull();
  });

  it('findExpiringBetween excludes never-expiring documents via the endDate range', async () => {
    prisma.complianceDocument.findMany.mockResolvedValue([]);
    const from = new Date('2026-07-01T00:00:00.000Z');
    const until = new Date('2026-07-08T00:00:00.000Z');
    await adapter.findExpiringBetween('user-1', from, until);
    expect(prisma.complianceDocument.findMany).toHaveBeenCalledWith({
      where: {
        kind: 'puc',
        vehicle: { members: { some: { userId: 'user-1' } } },
        endDate: { gte: from, lte: until },
      },
      orderBy: { endDate: 'asc' },
    });
  });

  it('create persists with its own kind and null-safe optionals', async () => {
    prisma.complianceDocument.create.mockResolvedValue(baseRow);
    await adapter.create('veh-1', {
      kind: 'puc',
      provider: 'Authorized PUC Center, Pune',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(prisma.complianceDocument.create).toHaveBeenCalledWith({
      data: {
        vehicleId: 'veh-1',
        kind: 'puc',
        provider: 'Authorized PUC Center, Pune',
        number: null,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        amount: null,
        notes: null,
      },
    });
  });
});

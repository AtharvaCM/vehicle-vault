import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaimsService } from './claims.service';

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const POLICY_ID = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const RECORD_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '55555555-5555-4555-8555-555555555555';

const claimRow = (overrides: Record<string, unknown> = {}) => ({
  id: CLAIM_ID,
  insurancePolicyId: POLICY_ID,
  maintenanceRecordId: null,
  claimNumber: 'CL-001',
  grossAmount: 50000 as unknown as Prisma.Decimal,
  insurerPaidAmount: 48000 as unknown as Prisma.Decimal,
  status: 'filed' as const,
  filedDate: new Date('2026-05-17T00:00:00.000Z'),
  settledDate: null,
  notes: null,
  createdAt: new Date('2026-05-17T00:00:00.000Z'),
  updatedAt: new Date('2026-05-17T00:00:00.000Z'),
  ...overrides,
});

describe('ClaimsService', () => {
  const prisma = {
    $transaction: vi.fn(),
    claim: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    insurancePolicy: {
      findUnique: vi.fn(),
    },
    maintenanceRecord: {
      findUnique: vi.fn(),
    },
  };

  const vehiclesService = {
    ensureVehicleExists: vi.fn(),
  };

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  let service: ClaimsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehiclesService.ensureVehicleExists.mockResolvedValue(undefined);
    auditService.track.mockResolvedValue(undefined);
    prisma.$transaction = vi.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(prisma);
      }
      return Array.isArray(arg) ? arg : undefined;
    });
    service = new ClaimsService(
      prisma as never,
      vehiclesService as never,
      auditService as never,
    );
  });

  describe('listForVehicle', () => {
    it('returns claims scoped to the vehicle via insurancePolicy.vehicleId', async () => {
      prisma.claim.findMany.mockResolvedValue([claimRow()]);

      const result = await service.listForVehicle(USER_ID, VEHICLE_ID);

      expect(vehiclesService.ensureVehicleExists).toHaveBeenCalledWith(USER_ID, VEHICLE_ID);
      expect(prisma.claim.findMany).toHaveBeenCalledWith({
        where: { insurancePolicy: { vehicleId: VEHICLE_ID } },
        orderBy: { filedDate: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(CLAIM_ID);
      expect(result[0]?.grossAmount).toBe(50000);
    });
  });

  describe('create', () => {
    it('rejects when the policy does not belong to the vehicle', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({ vehicleId: '88888888-8888-4888-8888-888888888888' });

      await expect(
        service.create(USER_ID, VEHICLE_ID, {
          insurancePolicyId: POLICY_ID,
          grossAmount: 50000,
          insurerPaidAmount: 48000,
          status: 'filed',
          filedDate: new Date('2026-05-17T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.claim.create).not.toHaveBeenCalled();
    });

    it('rejects when the linked maintenance record does not belong to the vehicle', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({ vehicleId: VEHICLE_ID });
      prisma.maintenanceRecord.findUnique.mockResolvedValue({ vehicleId: '88888888-8888-4888-8888-888888888888' });

      await expect(
        service.create(USER_ID, VEHICLE_ID, {
          insurancePolicyId: POLICY_ID,
          maintenanceRecordId: RECORD_ID,
          grossAmount: 50000,
          insurerPaidAmount: 48000,
          status: 'filed',
          filedDate: new Date('2026-05-17T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.claim.create).not.toHaveBeenCalled();
    });

    it('rejects when insurer paid exceeds gross', async () => {
      await expect(
        service.create(USER_ID, VEHICLE_ID, {
          insurancePolicyId: POLICY_ID,
          grossAmount: 1000,
          insurerPaidAmount: 1500,
          status: 'filed',
          filedDate: new Date('2026-05-17T00:00:00.000Z'),
        }),
      ).rejects.toThrow();
      expect(prisma.claim.create).not.toHaveBeenCalled();
    });

    it('rejects settled status without a settledDate', async () => {
      await expect(
        service.create(USER_ID, VEHICLE_ID, {
          insurancePolicyId: POLICY_ID,
          grossAmount: 1000,
          insurerPaidAmount: 1000,
          status: 'settled',
          filedDate: new Date('2026-05-17T00:00:00.000Z'),
        }),
      ).rejects.toThrow();
    });

    it('persists a valid claim with normalised nullables', async () => {
      prisma.insurancePolicy.findUnique.mockResolvedValue({ vehicleId: VEHICLE_ID });
      prisma.claim.create.mockResolvedValue(claimRow());

      await service.create(USER_ID, VEHICLE_ID, {
        insurancePolicyId: POLICY_ID,
        grossAmount: 50000,
        insurerPaidAmount: 48000,
        status: 'filed',
        filedDate: new Date('2026-05-17T00:00:00.000Z'),
      });

      expect(prisma.claim.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          insurancePolicyId: POLICY_ID,
          maintenanceRecordId: null,
          claimNumber: null,
          grossAmount: 50000,
          insurerPaidAmount: 48000,
          status: 'filed',
          settledDate: null,
          notes: null,
        }),
      });
    });
  });

  describe('update', () => {
    it('rejects with NotFoundException when claim is not owned by the user', async () => {
      prisma.claim.findUnique.mockResolvedValue({
        ...claimRow(),
        insurancePolicy: { vehicleId: VEHICLE_ID, vehicle: { userId: '99999999-9999-4999-8999-999999999999' } },
      });

      await expect(
        service.update(USER_ID, CLAIM_ID, { status: 'approved' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only writes the fields explicitly provided', async () => {
      prisma.claim.findUnique.mockResolvedValue({
        ...claimRow(),
        insurancePolicy: { vehicleId: VEHICLE_ID, vehicle: { userId: USER_ID } },
      });
      prisma.claim.update.mockResolvedValue(claimRow({ status: 'settled' }));

      await service.update(USER_ID, CLAIM_ID, {
        status: 'settled',
        settledDate: new Date('2026-05-25T00:00:00.000Z'),
      });

      const updateArg = prisma.claim.update.mock.calls[0]?.[0]?.data;
      expect(updateArg).toEqual({
        status: 'settled',
        settledDate: new Date('2026-05-25T00:00:00.000Z'),
      });
      expect(updateArg).not.toHaveProperty('grossAmount');
      expect(updateArg).not.toHaveProperty('notes');
    });
  });

  describe('remove', () => {
    it('deletes after ownership check', async () => {
      prisma.claim.findUnique.mockResolvedValue({
        ...claimRow(),
        insurancePolicy: { vehicleId: VEHICLE_ID, vehicle: { userId: USER_ID } },
      });
      prisma.claim.delete.mockResolvedValue(claimRow());

      await service.remove(USER_ID, CLAIM_ID);

      expect(prisma.claim.delete).toHaveBeenCalledWith({ where: { id: CLAIM_ID } });
    });

    it('throws NotFoundException when the claim is not owned', async () => {
      prisma.claim.findUnique.mockResolvedValue(null);

      await expect(service.remove(USER_ID, CLAIM_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.claim.delete).not.toHaveBeenCalled();
    });
  });
});

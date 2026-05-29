import { NotFoundException } from '@nestjs/common';
import type { VehicleDocument, VehicleDocumentKind } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleDocumentsService } from './vehicle-documents.service';
import type { VehicleDocumentAdapter } from './types';

function makeAdapter(kind: VehicleDocumentKind): VehicleDocumentAdapter {
  return {
    kind,
    listForVehicle: vi.fn(),
    findForOwnerCheck: vi.fn(),
    activeAt: vi.fn(),
    findExpiringBetween: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
}

function insuranceDoc(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'pol-1',
    vehicleId: 'veh-1',
    kind: 'insurance',
    provider: 'Acme',
    number: 'POL-1',
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2027-01-01T00:00:00.000Z'),
    notes: null,
    details: { premiumAmount: 100, insuredValue: 1000 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function warrantyDoc(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'wty-1',
    vehicleId: 'veh-1',
    kind: 'warranty',
    provider: 'OEM',
    number: null,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
    notes: null,
    details: { type: 'manufacturer', endOdometer: 100000 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('VehicleDocumentsService', () => {
  const vehiclesService = {
    ensureVehicleExists: vi.fn(),
  };

  const prisma = {};
  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
  };

  let insurance: VehicleDocumentAdapter;
  let warranty: VehicleDocumentAdapter;
  let service: VehicleDocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vehiclesService.ensureVehicleExists.mockResolvedValue(undefined);
    auditService.track.mockResolvedValue(undefined);
    insurance = makeAdapter('insurance');
    warranty = makeAdapter('warranty');
    service = new VehicleDocumentsService(
      vehiclesService as never,
      [insurance, warranty],
      prisma as never,
      auditService as never,
    );
  });

  describe('listForVehicle', () => {
    it('flattens all adapter results when kind is omitted', async () => {
      (insurance.listForVehicle as ReturnType<typeof vi.fn>).mockResolvedValue([
        insuranceDoc(),
      ]);
      (warranty.listForVehicle as ReturnType<typeof vi.fn>).mockResolvedValue([
        warrantyDoc(),
      ]);

      const result = await service.listForVehicle('user-1', 'veh-1');

      expect(vehiclesService.ensureVehicleExists).toHaveBeenCalledWith('user-1', 'veh-1');
      expect(result.map((d) => d.kind).sort()).toEqual(['insurance', 'warranty']);
    });

    it('routes to the requested adapter only when kind is provided', async () => {
      (insurance.listForVehicle as ReturnType<typeof vi.fn>).mockResolvedValue([
        insuranceDoc(),
      ]);

      const result = await service.listForVehicle('user-1', 'veh-1', 'insurance');

      expect(warranty.listForVehicle).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.kind).toBe('insurance');
    });
  });

  describe('create', () => {
    it('validates kind-discriminated input and dispatches to the matching adapter', async () => {
      (insurance.create as ReturnType<typeof vi.fn>).mockResolvedValue(insuranceDoc());

      await service.create('user-1', 'veh-1', {
        kind: 'insurance',
        provider: 'Acme',
        policyNumber: 'POL-1',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-01T00:00:00.000Z'),
      });

      expect(vehiclesService.ensureVehicleExists).toHaveBeenCalledWith('user-1', 'veh-1');
      expect(insurance.create).toHaveBeenCalledWith(
        'veh-1',
        expect.objectContaining({ kind: 'insurance', policyNumber: 'POL-1' }),
      );
      expect(warranty.create).not.toHaveBeenCalled();
    });

    it('rejects payloads missing the kind discriminator', async () => {
      await expect(
        service.create('user-1', 'veh-1', {
          // @ts-expect-error: deliberately missing kind to exercise zod validation
          provider: 'Acme',
          policyNumber: 'POL-1',
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('rejects with NotFoundException when the document does not belong to the user', async () => {
      (insurance.findForOwnerCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
        document: insuranceDoc(),
        vehicleUserId: 'someone-else',
      });

      await expect(
        service.update('user-1', 'pol-1', {
          kind: 'insurance',
          provider: 'Updated',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(insurance.update).not.toHaveBeenCalled();
    });

    it('rejects with NotFoundException when the adapter cannot find the row', async () => {
      (warranty.findForOwnerCheck as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.update('user-1', 'missing', {
          kind: 'warranty',
          notes: 'updated',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('delegates to the matching adapter on a valid owner check', async () => {
      (warranty.findForOwnerCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
        document: warrantyDoc(),
        vehicleUserId: 'user-1',
      });
      (warranty.update as ReturnType<typeof vi.fn>).mockResolvedValue(
        warrantyDoc({ notes: 'updated' }),
      );

      const result = await service.update('user-1', 'wty-1', {
        kind: 'warranty',
        notes: 'updated',
      });

      expect(warranty.update).toHaveBeenCalledWith(
        'wty-1',
        expect.objectContaining({ kind: 'warranty', notes: 'updated' }),
      );
      expect(insurance.update).not.toHaveBeenCalled();
      expect(result.notes).toBe('updated');
    });
  });

  describe('remove', () => {
    it('requires kind to dispatch the ownership check', async () => {
      (insurance.findForOwnerCheck as ReturnType<typeof vi.fn>).mockResolvedValue({
        document: insuranceDoc(),
        vehicleUserId: 'user-1',
      });

      await service.remove('user-1', 'insurance', 'pol-1');

      expect(insurance.remove).toHaveBeenCalledWith('pol-1');
      expect(warranty.remove).not.toHaveBeenCalled();
    });
  });

  describe('findExpiring', () => {
    it('queries every adapter with a midnight-anchored range and flattens results', async () => {
      const fakeNow = new Date('2026-05-16T15:30:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fakeNow);

      (insurance.findExpiringBetween as ReturnType<typeof vi.fn>).mockResolvedValue([
        insuranceDoc(),
      ]);
      (warranty.findExpiringBetween as ReturnType<typeof vi.fn>).mockResolvedValue([
        warrantyDoc(),
      ]);

      const result = await service.findExpiring('user-1', 7);

      expect(insurance.findExpiringBetween).toHaveBeenCalledTimes(1);
      const [insArgs] = (insurance.findExpiringBetween as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, Date, Date];
      expect(insArgs).toBe('user-1');

      // `from` is today's midnight in the local TZ; `until` is 7 days later at 23:59:59.999.
      const fromArg = (insurance.findExpiringBetween as ReturnType<typeof vi.fn>).mock.calls[0][1] as Date;
      const untilArg = (insurance.findExpiringBetween as ReturnType<typeof vi.fn>).mock.calls[0][2] as Date;
      expect(fromArg.getHours()).toBe(0);
      expect(fromArg.getMinutes()).toBe(0);
      expect(untilArg.getHours()).toBe(23);
      expect(untilArg.getMinutes()).toBe(59);
      // Range spans 7 full days plus the trailing 23:59:59.999 of day 7.
      expect(
        Math.floor((untilArg.getTime() - fromArg.getTime()) / (24 * 60 * 60 * 1000)),
      ).toBe(7);

      expect(warranty.findExpiringBetween).toHaveBeenCalledTimes(1);
      expect(result.map((d) => d.kind).sort()).toEqual(['insurance', 'warranty']);

      vi.useRealTimers();
    });

    it('limits to a single adapter when kind is provided', async () => {
      (insurance.findExpiringBetween as ReturnType<typeof vi.fn>).mockResolvedValue([
        insuranceDoc(),
      ]);

      const result = await service.findExpiring('user-1', 7, 'insurance');

      expect(insurance.findExpiringBetween).toHaveBeenCalledTimes(1);
      expect(warranty.findExpiringBetween).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('activeCoverageAt', () => {
    it('asks both adapters by default and flattens results', async () => {
      (insurance.activeAt as ReturnType<typeof vi.fn>).mockResolvedValue([insuranceDoc()]);
      (warranty.activeAt as ReturnType<typeof vi.fn>).mockResolvedValue([warrantyDoc()]);
      const date = new Date('2026-06-15T00:00:00.000Z');

      const result = await service.activeCoverageAt('user-1', 'veh-1', date);

      expect(result.map((d) => d.kind).sort()).toEqual(['insurance', 'warranty']);
      expect(insurance.activeAt).toHaveBeenCalledWith('veh-1', date);
    });

    it('limits to a single adapter when kind is provided', async () => {
      (warranty.activeAt as ReturnType<typeof vi.fn>).mockResolvedValue([warrantyDoc()]);
      const date = new Date('2026-06-15T00:00:00.000Z');

      const result = await service.activeCoverageAt('user-1', 'veh-1', date, 'warranty');

      expect(insurance.activeAt).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});

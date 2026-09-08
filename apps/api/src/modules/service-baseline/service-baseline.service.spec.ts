import { AuditResourceType } from '@prisma/client';
import {
  MaintenanceCategory,
  ServiceBaselineStatus,
  VehicleType,
  FuelType,
} from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditCoverageScope, wrapTransactionForAudit } from '../../common/prisma/audit-coverage';
import { AuditService } from '../audit/audit.service';
import { ServiceBaselineService } from './service-baseline.service';

function makeFakePrisma() {
  const client = {
    serviceBaseline: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    maintenanceRecord: { findMany: vi.fn() },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const scope = new AuditCoverageScope();
      const result = await fn(wrapTransactionForAudit(client, scope));
      scope.throwIfViolations();
      return result;
    }),
  };
  return client;
}

const now = new Date('2026-09-08T00:00:00.000Z');

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'sb-1',
  vehicleId: 'v1',
  category: MaintenanceCategory.BrakePads,
  status: ServiceBaselineStatus.Known,
  lastDoneOdometer: 5_000,
  lastDoneDate: null,
  notes: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('ServiceBaselineService', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let service: ServiceBaselineService;

  const vehiclesService = { getVehicleById: vi.fn(), ensureVehicleExists: vi.fn() };
  const access = { assertEditor: vi.fn() };
  const intervalResolver = { resolveForVehicle: vi.fn() };

  const auditEventArgs = () =>
    prisma.auditEvent.create.mock.calls.map(
      ([arg]) => (arg as { data: Record<string, unknown> }).data,
    );

  beforeEach(() => {
    prisma = makeFakePrisma();
    vehiclesService.getVehicleById.mockResolvedValue({
      id: 'v1',
      catalogVariantId: null,
      vehicleType: VehicleType.Motorcycle,
      fuelType: FuelType.Petrol,
      odometer: 40_000,
    });
    vehiclesService.ensureVehicleExists.mockResolvedValue({ id: 'v1', odometer: 40_000 });
    access.assertEditor.mockResolvedValue('owner');
    intervalResolver.resolveForVehicle.mockResolvedValue({
      [MaintenanceCategory.BrakePads]: { km: 30_000, months: 24, source: 'default' },
      [MaintenanceCategory.EngineOil]: { km: 7_500, months: 6, source: 'default' },
    });
    prisma.serviceBaseline.findMany.mockResolvedValue([]);
    prisma.maintenanceRecord.findMany.mockResolvedValue([]);

    service = new ServiceBaselineService(
      prisma as never,
      vehiclesService as never,
      access as never,
      intervalResolver as never,
      new AuditService(prisma as never),
    );
  });

  describe('getCoverage', () => {
    it('reports every applicable category as unanswered when nothing is on file', async () => {
      const coverage = await service.getCoverage('u1', 'v1');

      expect(coverage.entries.map((entry) => entry.source)).toEqual(['unset', 'unset']);
      expect(coverage.unansweredCount).toBe(2);
    });

    it('asks only about categories that apply to this vehicle', async () => {
      // Resolved through MaintenanceIntervalResolver, so an EV is never asked
      // when its engine oil was last changed.
      intervalResolver.resolveForVehicle.mockResolvedValue({
        [MaintenanceCategory.BrakePads]: { km: 30_000, months: 24, source: 'default' },
      });

      const coverage = await service.getCoverage('u1', 'v1');

      expect(coverage.entries.map((entry) => entry.category)).toEqual([
        MaintenanceCategory.BrakePads,
      ]);
    });

    it('prefers a logged service over the baseline, and says so', async () => {
      prisma.serviceBaseline.findMany.mockResolvedValue([row()]);
      prisma.maintenanceRecord.findMany.mockResolvedValue([
        {
          category: MaintenanceCategory.BrakePads,
          odometer: 38_000,
          serviceDate: new Date('2026-06-01T00:00:00.000Z'),
        },
      ]);

      const coverage = await service.getCoverage('u1', 'v1');
      const pads = coverage.entries.find(
        (entry) => entry.category === MaintenanceCategory.BrakePads,
      );

      expect(pads).toMatchObject({ source: 'record', lastDoneOdometer: 38_000 });
      // The superseded baseline is still returned: the UI shows what was claimed
      // at onboarding next to what was later measured.
      expect(pads?.baseline?.lastDoneOdometer).toBe(5_000);
    });

    it('distinguishes a declared unknown from a category never asked about', async () => {
      prisma.serviceBaseline.findMany.mockResolvedValue([
        row({ status: ServiceBaselineStatus.Unknown, lastDoneOdometer: null }),
      ]);

      const coverage = await service.getCoverage('u1', 'v1');

      expect(
        coverage.entries.find((e) => e.category === MaintenanceCategory.BrakePads)?.source,
      ).toBe('declared-unknown');
      expect(
        coverage.entries.find((e) => e.category === MaintenanceCategory.EngineOil)?.source,
      ).toBe('unset');
      // Only the genuinely unasked category is left to answer.
      expect(coverage.unansweredCount).toBe(1);
    });
  });

  describe('upsertForVehicle', () => {
    it('creates a baseline and records it in the same transaction', async () => {
      prisma.serviceBaseline.create.mockResolvedValue(row());

      const saved = await service.upsertForVehicle('u1', 'v1', {
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Known,
            lastDoneOdometer: 5_000,
          },
        ],
      });

      expect(saved[0]).toMatchObject({ category: 'brake_pads', lastDoneOdometer: 5_000 });
      expect(auditEventArgs()).toEqual([
        expect.objectContaining({
          action: 'service_baseline.created',
          resourceType: AuditResourceType.service_baseline,
          resourceId: 'sb-1',
        }),
      ]);
    });

    it('updates the existing row for a category instead of duplicating it', async () => {
      prisma.serviceBaseline.findMany.mockResolvedValue([row()]);
      prisma.serviceBaseline.update.mockResolvedValue(row({ lastDoneOdometer: 12_000 }));

      await service.upsertForVehicle('u1', 'v1', {
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Known,
            lastDoneOdometer: 12_000,
          },
        ],
      });

      expect(prisma.serviceBaseline.create).not.toHaveBeenCalled();
      expect(auditEventArgs()[0]).toMatchObject({ action: 'service_baseline.updated' });
    });

    it('leaves categories absent from the payload untouched', async () => {
      // A history reconstructed from memory is partial by nature: answering
      // three questions is not a retraction of the other seven.
      prisma.serviceBaseline.findMany.mockResolvedValue([
        row({ id: 'sb-oil', category: MaintenanceCategory.EngineOil }),
      ]);
      prisma.serviceBaseline.create.mockResolvedValue(row());

      await service.upsertForVehicle('u1', 'v1', {
        entries: [
          {
            category: MaintenanceCategory.BrakePads,
            status: ServiceBaselineStatus.Unknown,
          },
        ],
      });

      expect(prisma.serviceBaseline.update).not.toHaveBeenCalled();
      expect(auditEventArgs()).toHaveLength(1);
    });

    it('rejects a known baseline that carries no figure', async () => {
      // Mirrors the CHECK constraint: it would silence the unknown alert without
      // ever supplying something to measure from.
      await expect(
        service.upsertForVehicle('u1', 'v1', {
          entries: [
            {
              category: MaintenanceCategory.BrakePads,
              status: ServiceBaselineStatus.Known,
            },
          ],
        }),
      ).rejects.toThrow();
    });

    it('rejects an unknown baseline that contradicts itself', async () => {
      await expect(
        service.upsertForVehicle('u1', 'v1', {
          entries: [
            {
              category: MaintenanceCategory.BrakePads,
              status: ServiceBaselineStatus.Unknown,
              lastDoneOdometer: 5_000,
            },
          ],
        }),
      ).rejects.toThrow();
    });

    it('rejects two entries claiming the same category', async () => {
      await expect(
        service.upsertForVehicle('u1', 'v1', {
          entries: [
            {
              category: MaintenanceCategory.BrakePads,
              status: ServiceBaselineStatus.Unknown,
            },
            {
              category: MaintenanceCategory.BrakePads,
              status: ServiceBaselineStatus.Known,
              lastDoneOdometer: 5_000,
            },
          ],
        }),
      ).rejects.toThrow();
    });

    it('refuses a viewer', async () => {
      access.assertEditor.mockRejectedValue(new Error('forbidden'));

      await expect(
        service.upsertForVehicle('u1', 'v1', {
          entries: [
            {
              category: MaintenanceCategory.BrakePads,
              status: ServiceBaselineStatus.Unknown,
            },
          ],
        }),
      ).rejects.toThrow('forbidden');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});

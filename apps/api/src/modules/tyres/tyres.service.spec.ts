import { AuditResourceType } from '@prisma/client';
import { TyrePosition } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuditCoverageError,
  AuditCoverageScope,
  wrapTransactionForAudit,
} from '../../common/prisma/audit-coverage';
import { AuditService } from '../audit/audit.service';
import { TyresService } from './tyres.service';

/**
 * The fake prisma runs the real ADR-0004 safety net around every interactive
 * transaction, exactly as PrismaService does outside production. A tyre write
 * that forgets `auditService.track` therefore fails here the same way it fails
 * against a real database.
 */
function makeFakePrisma() {
  const client = {
    tyre: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    tyreInspection: { create: vi.fn(), findMany: vi.fn() },
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

const TYRE_ROW = {
  id: 'tyre-1',
  vehicleId: 'v1',
  position: TyrePosition.FrontLeft,
  brand: 'Michelin',
  model: null,
  size: null,
  dotWeek: null,
  dotYear: null,
  fittedDate: new Date('2026-08-01T00:00:00.000Z'),
  fittedOdometer: 42_000,
  removedDate: null,
  removedOdometer: null,
  expectedLifeKm: null,
  notes: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const CREATE_PAYLOAD = {
  position: TyrePosition.FrontLeft,
  fittedDate: '2026-08-01T00:00:00.000Z',
  fittedOdometer: 42_000,
  brand: 'Michelin',
};

describe('TyresService audit coverage', () => {
  let prisma: ReturnType<typeof makeFakePrisma>;
  let service: TyresService;

  const vehiclesService = { ensureVehicleExists: vi.fn() };
  const access = { assertEditor: vi.fn() };
  const conditionResolver = { resolve: vi.fn(), worstLevel: vi.fn() };

  const auditEventArgs = () =>
    prisma.auditEvent.create.mock.calls.map(
      ([arg]) => (arg as { data: Record<string, unknown> }).data,
    );

  beforeEach(() => {
    prisma = makeFakePrisma();
    vehiclesService.ensureVehicleExists.mockResolvedValue({ id: 'v1', odometer: 42_000 });
    access.assertEditor.mockResolvedValue('owner');
    prisma.tyre.findMany.mockResolvedValue([]);
    prisma.tyre.create.mockResolvedValue(TYRE_ROW);
    prisma.tyre.updateMany.mockResolvedValue({ count: 0 });

    service = new TyresService(
      prisma as never,
      vehiclesService as never,
      access as never,
      conditionResolver as never,
      new AuditService(prisma as never),
    );
  });

  it('writes a tyre.created event inside the create transaction', async () => {
    const result = await service.createForVehicle('u1', 'v1', CREATE_PAYLOAD);

    expect(result.id).toBe('tyre-1');
    expect(auditEventArgs()).toEqual([
      expect.objectContaining({
        actorUserId: 'u1',
        ownerUserId: 'u1',
        action: 'tyre.created',
        resourceType: AuditResourceType.tyre,
        resourceId: 'tyre-1',
      }),
    ]);
  });

  it('also records the tyre that the new fitting retires', async () => {
    prisma.tyre.findMany.mockResolvedValueOnce([{ ...TYRE_ROW, id: 'tyre-old' }]);

    await service.createForVehicle('u1', 'v1', CREATE_PAYLOAD);

    const [retired, created] = auditEventArgs();
    expect(retired).toMatchObject({
      action: 'tyre.updated',
      resourceId: 'tyre-old',
    });
    expect((retired?.after as Record<string, unknown>).removedOdometer).toBe(42_000);
    expect(created).toMatchObject({ action: 'tyre.created', resourceId: 'tyre-1' });
  });

  it('fails the ADR-0004 safety net if the create transaction emits no event', async () => {
    // Simulates the pre-fix service: the same transaction body without track().
    await expect(
      prisma.$transaction(async (tx) => {
        await (tx as typeof prisma).tyre.create({ data: {} as never });
      }),
    ).rejects.toBeInstanceOf(AuditCoverageError);
  });

  it('writes a tyre.updated event inside the update transaction', async () => {
    prisma.tyre.findUnique.mockResolvedValue(TYRE_ROW);
    prisma.tyre.update.mockResolvedValue({ ...TYRE_ROW, brand: 'Bridgestone' });

    await service.updateTyre('u1', 'tyre-1', { brand: 'Bridgestone' });

    expect(auditEventArgs()).toEqual([
      expect.objectContaining({
        action: 'tyre.updated',
        resourceType: AuditResourceType.tyre,
        resourceId: 'tyre-1',
      }),
    ]);
    expect(auditEventArgs()[0]?.changedFields).toContain('brand');
  });

  it('writes a tyre.deleted event inside the delete transaction', async () => {
    prisma.tyre.findUnique.mockResolvedValue(TYRE_ROW);
    prisma.tyre.delete.mockResolvedValue(TYRE_ROW);

    await service.deleteTyre('u1', 'tyre-1');

    expect(auditEventArgs()).toEqual([
      expect.objectContaining({ action: 'tyre.deleted', resourceId: 'tyre-1' }),
    ]);
  });

  it('records an inspection against the tyre it measures', async () => {
    prisma.tyre.findFirst.mockResolvedValue(TYRE_ROW);
    prisma.tyreInspection.create.mockResolvedValue({
      id: 'insp-1',
      tyreId: 'tyre-1',
      vehicleId: 'v1',
      inspectedAt: new Date('2026-08-20T00:00:00.000Z'),
      odometer: 43_000,
      treadDepthMm: null,
      pressurePsi: null,
      notes: null,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      updatedAt: new Date('2026-08-20T00:00:00.000Z'),
    });

    await service.createInspection('u1', 'v1', {
      tyreId: 'tyre-1',
      inspectedAt: '2026-08-20T00:00:00.000Z',
      odometer: 43_000,
      treadDepthMm: 5.5,
    });

    expect(auditEventArgs()).toEqual([
      expect.objectContaining({
        action: 'tyre.inspected',
        resourceType: AuditResourceType.tyre,
        resourceId: 'tyre-1',
      }),
    ]);
  });
});

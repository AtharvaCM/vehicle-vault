import { AuditResourceType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditQueryService } from './audit-query.service';

function prismaMock() {
  return {
    auditEvent: { findMany: vi.fn() },
    vehicle: { findFirst: vi.fn() },
    maintenanceRecord: { findMany: vi.fn() },
    reminder: { findMany: vi.fn() },
    insurancePolicy: { findMany: vi.fn() },
    warranty: { findMany: vi.fn() },
    claim: { findMany: vi.fn() },
    fuelLog: { findMany: vi.fn() },
  };
}

describe('AuditQueryService.listForOwner', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: AuditQueryService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new AuditQueryService(prisma as never);
  });

  it('filters by ownerUserId OR actorUserId and returns rows in occurredAt desc order', async () => {
    prisma.auditEvent.findMany.mockResolvedValue([
      { id: 'a', occurredAt: new Date('2026-05-28T12:00:00Z') },
      { id: 'b', occurredAt: new Date('2026-05-27T12:00:00Z') },
    ]);

    const result = await service.listForOwner('user-1', {});

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ ownerUserId: 'user-1' }, { actorUserId: 'user-1' }],
        }),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.events).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('returns a nextCursor when there are more rows than requested', async () => {
    prisma.auditEvent.findMany.mockResolvedValue(
      [1, 2, 3].map((n) => ({
        id: `row-${n}`,
        occurredAt: new Date(`2026-05-28T12:0${n}:00Z`),
      })),
    );

    const result = await service.listForOwner('user-1', { limit: 2 });

    expect(result.events).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it('applies an actionPrefix filter as startsWith', async () => {
    prisma.auditEvent.findMany.mockResolvedValue([]);

    await service.listForOwner('user-1', { actionPrefix: 'auth.' });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { startsWith: 'auth.' },
        }),
      }),
    );
  });
});

describe('AuditQueryService.listForVehicle', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: AuditQueryService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new AuditQueryService(prisma as never);
  });

  it('rejects with NotFound when the vehicle is not owned by the user', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.listForVehicle('user-1', '00000000-0000-0000-0000-000000000001', {}),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('builds an OR over each descendant resource type', async () => {
    prisma.vehicle.findFirst.mockResolvedValue({ id: 'v1' });
    prisma.maintenanceRecord.findMany.mockResolvedValue([{ id: 'm1' }]);
    prisma.reminder.findMany.mockResolvedValue([]);
    prisma.insurancePolicy.findMany.mockResolvedValue([{ id: 'p1' }]);
    prisma.warranty.findMany.mockResolvedValue([]);
    prisma.claim.findMany.mockResolvedValue([]);
    prisma.fuelLog.findMany.mockResolvedValue([{ id: 'f1' }]);
    prisma.auditEvent.findMany.mockResolvedValue([]);

    await service.listForVehicle('user-1', 'v1', {});

    const call = prisma.auditEvent.findMany.mock.calls[0]![0]!;
    expect(call.where.ownerUserId).toBe('user-1');
    expect(call.where.OR).toEqual(
      expect.arrayContaining([
        { resourceType: AuditResourceType.vehicle, resourceId: { in: ['v1'] } },
        { resourceType: AuditResourceType.maintenance_record, resourceId: { in: ['m1'] } },
        { resourceType: AuditResourceType.insurance_policy, resourceId: { in: ['p1'] } },
        { resourceType: AuditResourceType.fuel_log, resourceId: { in: ['f1'] } },
      ]),
    );
  });
});

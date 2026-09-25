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
    tyre: { findMany: vi.fn() },
    accessory: { findMany: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    vehicleLoan: { findMany: vi.fn() },
  };
}

describe('AuditQueryService feed details', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: AuditQueryService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new AuditQueryService(prisma as never);
  });

  it('names the actor, as "you" for the caller, and says whether the record still exists', async () => {
    prisma.auditEvent.findMany.mockResolvedValue([
      {
        id: 'e1',
        occurredAt: new Date('2026-09-25T10:00:00Z'),
        actorUserId: 'user-1',
        resourceType: AuditResourceType.fuel_log,
        resourceId: 'fill-kept',
      },
      {
        id: 'e2',
        occurredAt: new Date('2026-09-25T09:00:00Z'),
        actorUserId: 'user-2',
        resourceType: AuditResourceType.fuel_log,
        resourceId: 'fill-gone',
      },
      {
        id: 'e3',
        occurredAt: new Date('2026-09-25T08:00:00Z'),
        actorUserId: null,
        resourceType: AuditResourceType.user,
        resourceId: 'user-1',
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', name: 'Asha' },
      { id: 'user-2', name: 'Priya' },
    ]);
    prisma.fuelLog.findMany.mockResolvedValue([{ id: 'fill-kept' }]);

    const { events } = await service.listForOwner('user-1', {});

    expect(events.map((event) => [event.actor, event.resourceExists])).toEqual([
      [{ name: 'Asha', isYou: true }, true],
      [{ name: 'Priya', isYou: false }, false],
      [null, null],
    ]);
    // One lookup per kind of record on the page.
    expect(prisma.fuelLog.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.fuelLog.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['fill-kept', 'fill-gone'] } },
      select: { id: true },
    });
  });

  it('splits sign-ins and security from garage changes', async () => {
    prisma.auditEvent.findMany.mockResolvedValue([]);
    const security = [{ action: { startsWith: 'auth.' } }, { action: { startsWith: 'admin.' } }];

    await service.listForOwner('user-1', { category: 'security' });
    expect(prisma.auditEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ AND: [{ OR: security }] }) }),
    );

    await service.listForOwner('user-1', { category: 'garage' });
    expect(prisma.auditEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ AND: [{ NOT: security }] }) }),
    );
  });
});

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
    prisma.tyre.findMany.mockResolvedValue([{ id: 't1' }]);
    prisma.accessory.findMany.mockResolvedValue([{ id: 'a1' }]);
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
        { resourceType: AuditResourceType.tyre, resourceId: { in: ['t1'] } },
        { resourceType: AuditResourceType.accessory, resourceId: { in: ['a1'] } },
      ]),
    );
  });
});

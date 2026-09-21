import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service';

describe('AuditService.anonymiseForUser', () => {
  const rows = [
    // Their own action on their own account.
    {
      id: 'own',
      actorUserId: 'user-1',
      ownerUserId: 'user-1',
      before: null,
      after: { email: 'e2e+1@vehiclevault.dev', name: 'E2E User' },
    },
    // Someone else acting on their vehicle.
    {
      id: 'about-them',
      actorUserId: 'user-2',
      ownerUserId: 'user-1',
      before: { nickname: 'Dad’s Pulsar' },
      after: { nickname: 'Pulsar' },
    },
    // Them editing a vehicle someone else owns and still has.
    {
      id: 'their-edit-elsewhere',
      actorUserId: 'user-1',
      ownerUserId: 'user-3',
      before: { odometer: 40_000 },
      after: { odometer: 41_000 },
    },
  ];
  const client = {
    auditEvent: { findMany: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
  };

  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    client.auditEvent.findMany.mockResolvedValue(rows);
    service = new AuditService(prisma as never);
  });

  const updateFor = (id: string) =>
    client.auditEvent.update.mock.calls.find(([args]) => args.where.id === id)?.[0].data;

  it('finds every row they acted on or own', async () => {
    await service.anonymiseForUser('user-1');

    expect(client.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ actorUserId: 'user-1' }, { ownerUserId: 'user-1' }] },
      }),
    );
  });

  it('leaves nothing on their own rows that says who they were', async () => {
    await service.anonymiseForUser('user-1');

    expect(updateFor('own')).toEqual({
      actorUserId: null,
      ipAddress: null,
      userAgent: null,
      ownerUserId: null,
      before: null,
      // The write-time redaction keeps name and email; deletion must not.
      after: { email: '[redacted]', name: '[redacted]' },
    });
  });

  it('blanks rows about their data even when someone else made the change', async () => {
    await service.anonymiseForUser('user-1');

    expect(updateFor('about-them')).toEqual({
      ownerUserId: null,
      before: { nickname: '[redacted]' },
      after: { nickname: '[redacted]' },
    });
  });

  it('keeps the other owner’s history of what they changed, minus who changed it', async () => {
    await service.anonymiseForUser('user-1');

    expect(updateFor('their-edit-elsewhere')).toEqual({
      actorUserId: null,
      ipAddress: null,
      userAgent: null,
    });
  });

  it('runs inside the caller’s transaction when given one', async () => {
    await service.anonymiseForUser('user-1', client as never);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(client.auditEvent.update).toHaveBeenCalledTimes(3);
  });

  it('opens its own transaction otherwise', async () => {
    await service.anonymiseForUser('user-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

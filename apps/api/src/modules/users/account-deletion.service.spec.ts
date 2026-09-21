import { ConflictException, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountDeletionService, storagePrefixesFor } from './account-deletion.service';

const USER = { id: 'user-1', email: 'e2e+1@vehiclevault.dev', createdAt: new Date('2026-05-01') };

describe('AccountDeletionService', () => {
  const calls: string[] = [];

  const tx = {
    user: { delete: vi.fn(async () => calls.push('user.delete')) },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    vehicle: { findMany: vi.fn() },
    attachment: { findMany: vi.fn() },
    auditEvent: { count: vi.fn() },
    notification: { count: vi.fn() },
    productEvent: { count: vi.fn() },
    vehicleMember: { count: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => {
      calls.push('transaction:start');
      await fn(tx);
      calls.push('transaction:commit');
    }),
  };
  const audit = {
    anonymiseForUser: vi.fn(async () => calls.push('anonymise')),
    track: vi.fn(async () => calls.push('audit.track')),
  };
  /** Storage as a set of paths, so listing and deleting agree with each other. */
  let stored: Set<string>;
  const storage = {
    listObjectPaths: vi.fn(async (prefix: string) =>
      [...stored].filter((path) => path.startsWith(`${prefix}/`)),
    ),
    deleteObject: vi.fn(async (path: string) => {
      calls.push(`storage.delete ${path}`);
      return stored.delete(path) ? ('deleted' as const) : ('missing' as const);
    }),
  };

  let service: AccountDeletionService;

  /** The owned vehicles and the attachment rows that exist before and after deletion. */
  function given({
    vehicles = [] as { id: string; members: { userId: string }[] }[],
    vehicleFiles = [] as string[],
    rowsAfterDeletion = [] as string[],
  }) {
    prisma.vehicle.findMany.mockResolvedValue(
      vehicles.map((vehicle) => ({ make: 'Bajaj', model: 'Pulsar', nickname: null, ...vehicle })),
    );
    // First call: the plan's rows under owned vehicles. Later calls: the
    // sweep asking which stored paths still have a row after the cascade.
    prisma.attachment.findMany.mockImplementation(
      async (args: { where: { fileName?: unknown } }) =>
        args.where.fileName
          ? rowsAfterDeletion.map((fileName) => ({ fileName }))
          : vehicleFiles.map((fileName) => ({ fileName })),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    stored = new Set();
    prisma.user.findUnique.mockResolvedValue(USER);
    prisma.auditEvent.count.mockResolvedValue(12);
    prisma.notification.count.mockResolvedValue(3);
    prisma.productEvent.count.mockResolvedValue(0);
    prisma.vehicleMember.count.mockResolvedValue(0);
    given({});
    service = new AccountDeletionService(prisma as never, audit as never, storage as never);
  });

  describe('plan', () => {
    it('says what deleting the account would remove, touching nothing', async () => {
      stored = new Set([
        'attachments/user-1/record-1/a.pdf',
        'claim-attachments/user-1/claim-1/b.jpg',
        'attachments/user-2/record-9/c.pdf',
      ]);
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }] }],
        vehicleFiles: ['attachments/user-1/record-1/a.pdf'],
      });

      const plan = await service.plan('user-1');

      expect(plan).toMatchObject({
        userId: 'user-1',
        email: USER.email,
        ownedVehicles: [{ id: 'vehicle-1', label: 'Bajaj Pulsar', otherMembers: 0 }],
        attachmentFiles: ['attachments/user-1/record-1/a.pdf'],
        auditEvents: 12,
        notifications: 3,
      });
      // Both upload roots, and only this user's prefix within them.
      expect(plan.storedObjects.sort()).toEqual([
        'attachments/user-1/record-1/a.pdf',
        'claim-attachments/user-1/claim-1/b.jpg',
      ]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(storage.deleteObject).not.toHaveBeenCalled();
    });

    it('reports a vehicle shared with someone else', async () => {
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }, { userId: 'user-2' }] }],
      });

      const plan = await service.plan('user-1');

      expect(plan.ownedVehicles[0]?.otherMembers).toBe(1);
    });

    it('refuses an account that does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.plan('user-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('will not delete a vehicle out from under the other people it is shared with', async () => {
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }, { userId: 'user-2' }] }],
      });

      await expect(service.deleteAccount('user-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('anonymises the trail, deletes the user and records it, in one transaction', async () => {
      given({ vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }] }] });

      await service.deleteAccount('user-1');

      expect(calls.slice(0, 5)).toEqual([
        'transaction:start',
        'anonymise',
        'user.delete',
        'audit.track',
        'transaction:commit',
      ]);
      expect(audit.anonymiseForUser).toHaveBeenCalledWith('user-1', tx);
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(audit.track).toHaveBeenCalledWith(tx, {
        actorUserId: null,
        ownerUserId: null,
        action: 'auth.account_deleted',
        resourceType: AuditResourceType.user,
        resourceId: 'user-1',
        before: null,
        after: { vehiclesDeleted: 1 },
      });
      // A long-lived account has many audit rows to walk.
      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ timeout: 120_000 }),
      );
    });

    it('removes the files only once the rows are gone', async () => {
      stored = new Set(['attachments/user-1/record-1/a.pdf']);
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }] }],
        vehicleFiles: ['attachments/user-1/record-1/a.pdf', 'attachments/user-1/record-1/gone.pdf'],
      });

      const result = await service.deleteAccount('user-1');

      expect(calls.indexOf('storage.delete attachments/user-1/record-1/a.pdf')).toBeGreaterThan(
        calls.indexOf('transaction:commit'),
      );
      expect(result).toMatchObject({ filesDeleted: 1, filesAlreadyGone: 1, storageFailures: [] });
    });

    it('sweeps stray files under their prefix but keeps what they uploaded to other vehicles', async () => {
      stored = new Set([
        'attachments/user-1/record-1/a.pdf',
        // Uploaded as an editor to someone else's record: its row survives the cascade.
        'attachments/user-1/record-9/theirs.pdf',
        // From a failed upload or an old deletion: nothing points at it.
        'claim-attachments/user-1/claim-3/stray.jpg',
      ]);
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }] }],
        vehicleFiles: ['attachments/user-1/record-1/a.pdf'],
        rowsAfterDeletion: ['attachments/user-1/record-9/theirs.pdf'],
      });

      const result = await service.deleteAccount('user-1');

      expect(result.orphansDeleted).toBe(1);
      expect([...stored]).toEqual(['attachments/user-1/record-9/theirs.pdf']);
    });

    it('reports a file storage refused to remove instead of failing the whole deletion', async () => {
      stored = new Set(['attachments/user-1/record-1/a.pdf']);
      given({
        vehicles: [{ id: 'vehicle-1', members: [{ userId: 'user-1' }] }],
        vehicleFiles: ['attachments/user-1/record-1/a.pdf'],
      });
      storage.deleteObject.mockRejectedValueOnce(new Error('storage is down'));

      const result = await service.deleteAccount('user-1');

      expect(result.storageFailures).toContain('attachments/user-1/record-1/a.pdf');
      expect(tx.user.delete).toHaveBeenCalled();
    });
  });

  it('knows both places a user’s uploads are stored', () => {
    expect(storagePrefixesFor('user-1')).toEqual([
      'attachments/user-1',
      'claim-attachments/user-1',
    ]);
  });
});

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminService } from './admin.service';

describe('AdminService', () => {
  const prisma = {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };

  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService.track.mockResolvedValue(undefined);
    service = new AdminService(prisma as never, auditService as never);
  });

  describe('listUsers', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (queries: Promise<unknown>[]) =>
        Promise.all(queries),
      );
      prisma.user.count.mockResolvedValue(3);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          name: 'Alice',
          email: 'alice@example.com',
          role: 'user',
          emailVerified: true,
          allowedCatalogSources: [],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          _count: { vehicles: 2 },
        },
      ]);
    });

    it('returns paginated users with default page + limit', async () => {
      const result = await service.listUsers();
      expect(result.users).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, limit: 25, total: 3, search: undefined });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25, where: undefined }),
      );
    });

    it('applies search as case-insensitive OR on email + name', async () => {
      await service.listUsers({ search: 'Alice' });
      const args = prisma.user.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        OR: [
          { email: { contains: 'Alice', mode: 'insensitive' } },
          { name: { contains: 'Alice', mode: 'insensitive' } },
        ],
      });
    });

    it('clamps limit to MAX_LIMIT (100)', async () => {
      await service.listUsers({ limit: 9999 });
      expect(prisma.user.findMany.mock.calls[0][0].take).toBe(100);
    });

    it('computes skip from page', async () => {
      await service.listUsers({ page: 3, limit: 10 });
      expect(prisma.user.findMany.mock.calls[0][0].skip).toBe(20);
      expect(prisma.user.findMany.mock.calls[0][0].take).toBe(10);
    });
  });

  describe('forceLogout', () => {
    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
        cb(prisma),
      );
    });

    it('throws NotFound when target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.forceLogout('admin-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('clears refresh token and audits when user was logged in', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', refreshTokenHash: 'abc' });
      const result = await service.forceLogout('admin-1', 'u1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { refreshTokenHash: null },
      });
      expect(auditService.track).toHaveBeenCalledTimes(1);
      expect(auditService.track.mock.calls[0][1]).toMatchObject({
        actorUserId: 'admin-1',
        ownerUserId: 'u1',
        action: 'admin.force_logout',
      });
      expect(result).toEqual({ userId: 'u1', refreshTokenCleared: true });
    });

    it('still succeeds when user had no active refresh token', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', refreshTokenHash: null });
      const result = await service.forceLogout('admin-1', 'u1');
      expect(result).toEqual({ userId: 'u1', refreshTokenCleared: false });
    });
  });
});

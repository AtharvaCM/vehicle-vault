import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountSelfDeletionService } from './account-self-deletion.service';

describe('AccountSelfDeletionService', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    authSession: { findUnique: vi.fn() },
  };
  const accountDeletion = { plan: vi.fn(), deleteAccount: vi.fn() };
  let service: AccountSelfDeletionService;

  const plan = (ownedVehicles: { id: string; label: string; otherMembers: number }[] = []) => ({
    ownedVehicles,
    attachmentFiles: ['attachments/u1/a.png', 'attachments/u1/b.pdf'],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AccountSelfDeletionService(prisma as never, accountDeletion as never);
    accountDeletion.plan.mockResolvedValue(plan());
    accountDeletion.deleteAccount.mockResolvedValue({ vehiclesDeleted: 1 });
  });

  describe('check', () => {
    it('says what would go and lists the shared vehicles in the way', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: 'x' });
      accountDeletion.plan.mockResolvedValue(
        plan([
          { id: 'v1', label: 'Family', otherMembers: 2 },
          { id: 'v2', label: 'Bike', otherMembers: 0 },
        ]),
      );

      await expect(service.check('u1', 's1')).resolves.toEqual({
        hasPassword: true,
        needsFreshSignIn: false,
        vehicleCount: 2,
        fileCount: 2,
        sharedVehicles: [{ id: 'v1', label: 'Family', otherMembers: 2 }],
      });
    });

    it('asks an account with no password to sign in again once its sign-in is old', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: null });
      prisma.authSession.findUnique.mockResolvedValue({
        createdAt: new Date(Date.now() - 60 * 60_000),
      });

      await expect(service.check('u1', 's1')).resolves.toMatchObject({
        hasPassword: false,
        needsFreshSignIn: true,
      });
    });
  });

  describe('delete', () => {
    it('deletes after the right password', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: await hash('pass-word-1', 4) });

      await expect(service.delete('u1', 's1', { password: 'pass-word-1' })).resolves.toEqual({
        deleted: true,
        vehiclesDeleted: 1,
      });
      expect(accountDeletion.deleteAccount).toHaveBeenCalledWith('u1');
    });

    it('refuses a wrong password with a 400 and deletes nothing', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: await hash('pass-word-1', 4) });

      await expect(service.delete('u1', 's1', { password: 'nope' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(accountDeletion.deleteAccount).not.toHaveBeenCalled();
    });

    it('lets an account with no password confirm with a fresh sign-in, and only then', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: null });
      prisma.authSession.findUnique.mockResolvedValue({
        createdAt: new Date(Date.now() - 60 * 60_000),
      });
      await expect(service.delete('u1', 's1', {})).rejects.toBeInstanceOf(ForbiddenException);
      expect(accountDeletion.deleteAccount).not.toHaveBeenCalled();

      prisma.authSession.findUnique.mockResolvedValue({ createdAt: new Date() });
      await expect(service.delete('u1', 's1', {})).resolves.toMatchObject({ deleted: true });
    });

    it('explains, in plain words, a refusal over shared vehicles', async () => {
      prisma.user.findUnique.mockResolvedValue({ passwordHash: await hash('pass-word-1', 4) });
      accountDeletion.deleteAccount.mockRejectedValue(new ConflictException('owns 1 vehicle(s)'));

      await expect(service.delete('u1', 's1', { password: 'pass-word-1' })).rejects.toThrow(
        /Hand over or stop sharing/,
      );
    });
  });
});

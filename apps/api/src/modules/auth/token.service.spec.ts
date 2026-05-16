import { createHash } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMAIL_VERIFICATION_TTL_MS, TokenService } from './token.service';

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe('TokenService', () => {
  type UserDelegateMock = {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    user: UserDelegateMock;
  };

  const prisma: PrismaMock = {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  const appConfigService = {
    frontendOrigin: 'https://vehicle-vault-eight.vercel.app',
  };

  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    service = new TokenService(prisma as never, appConfigService as never);
  });

  describe('issueEmailVerification', () => {
    it('persists a hashed token with a 7-day expiry and returns the raw token + url', async () => {
      const now = new Date('2026-05-16T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      prisma.user.update.mockResolvedValue(undefined);

      const { token, url } = await service.issueEmailVerification('user-1');

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(url).toBe(
        `https://vehicle-vault-eight.vercel.app/verify-email?token=${token}`,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          emailVerificationTokenHash: hash(token),
          emailVerificationTokenExpiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
        },
      });
    });

    it('produces a different token on each call', async () => {
      prisma.user.update.mockResolvedValue(undefined);

      const first = await service.issueEmailVerification('user-1');
      const second = await service.issueEmailVerification('user-1');

      expect(first.token).not.toBe(second.token);
    });
  });

  describe('consumeEmailVerification', () => {
    it('marks the user verified and clears token state on the happy path', async () => {
      const token = 'happy-token';
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.update.mockResolvedValue(undefined);

      const result = await service.consumeEmailVerification(token);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { emailVerificationTokenHash: hash(token) },
        select: expect.any(Object),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiresAt: null,
        },
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
      });
    });

    it('throws UnauthorizedException when no user matches the hashed token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.consumeEmailVerification('invalid')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the matched record has no expiry recorded', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        emailVerificationTokenExpiresAt: null,
      });

      await expect(service.consumeEmailVerification('legacy-no-ttl')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token has expired', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        emailVerificationTokenExpiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.consumeEmailVerification('expired-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('cannot be replayed: the second consume after a successful first sees no matching row', async () => {
      const token = 'one-shot';

      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'atharva@example.com',
          name: 'Atharva',
          emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce(null);
      prisma.user.update.mockResolvedValue(undefined);

      await service.consumeEmailVerification(token);

      await expect(service.consumeEmailVerification(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('timingSafeCompare helper', () => {
    // The helper is private but reachable via class cast. Validates the
    // crypto.timingSafeEqual-backed contract that slice 3c will rely on.
    type WithHelper = TokenService & {
      timingSafeCompare(a: string, b: string): boolean;
    };

    it('returns true for identical hex digests', () => {
      const a = hash('same');
      expect((service as WithHelper).timingSafeCompare(a, a)).toBe(true);
    });

    it('returns false for differing hex digests of the same length', () => {
      expect(
        (service as WithHelper).timingSafeCompare(hash('a'), hash('b')),
      ).toBe(false);
    });

    it('returns false for digests of differing lengths without throwing', () => {
      expect((service as WithHelper).timingSafeCompare('abcd', 'abcdef')).toBe(false);
    });
  });
});

import { createHash } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  TokenService,
} from './token.service';

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe('TokenService', () => {
  type UserDelegateMock = {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    user: UserDelegateMock;
  };

  type JwtServiceMock = {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };

  const prisma: PrismaMock = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const appConfigService = {
    frontendOrigin: 'https://vehicle-vault-eight.vercel.app',
    jwtRefreshSecret: 'refresh-secret',
    jwtRefreshExpiresIn: '30d',
  };

  const jwtService: JwtServiceMock = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  let service: TokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    service = new TokenService(
      prisma as never,
      appConfigService as never,
      jwtService as never,
    );
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

  describe('issuePasswordReset', () => {
    it('persists a hashed token with a 30-minute expiry and returns token + url + expiresAt', async () => {
      const now = new Date('2026-05-16T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      prisma.user.update.mockResolvedValue(undefined);

      const { token, url, expiresAt } = await service.issuePasswordReset('user-1');

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(url).toBe(
        `https://vehicle-vault-eight.vercel.app/reset-password?token=${token}`,
      );
      expect(expiresAt).toEqual(new Date(now.getTime() + PASSWORD_RESET_TTL_MS));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordResetTokenHash: hash(token),
          passwordResetTokenExpiresAt: expiresAt,
        },
      });
    });

    it('produces a different token on each call', async () => {
      prisma.user.update.mockResolvedValue(undefined);

      const first = await service.issuePasswordReset('user-1');
      const second = await service.issuePasswordReset('user-1');

      expect(first.token).not.toBe(second.token);
    });
  });

  describe('consumePasswordReset', () => {
    it('clears reset state and returns the user identity on the happy path', async () => {
      const token = 'happy-reset';
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.update.mockResolvedValue(undefined);

      const result = await service.consumePasswordReset(token);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { passwordResetTokenHash: hash(token) },
        select: expect.any(Object),
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
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

      await expect(service.consumePasswordReset('invalid')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the matched record has no expiry recorded', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        passwordResetTokenExpiresAt: null,
      });

      await expect(service.consumePasswordReset('legacy-no-ttl')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token has expired', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        passwordResetTokenExpiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.consumePasswordReset('expired')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('cannot be replayed: the second consume after a successful first sees no matching row', async () => {
      const token = 'one-shot-reset';

      prisma.user.findFirst
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'atharva@example.com',
          name: 'Atharva',
          passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
        })
        .mockResolvedValueOnce(null);
      prisma.user.update.mockResolvedValue(undefined);

      await service.consumePasswordReset(token);

      await expect(service.consumePasswordReset(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('rotateRefreshToken', () => {
    const authUser = {
      id: 'user-1',
      email: 'atharva@example.com',
      name: 'Atharva',
      emailVerified: true,
      allowedCatalogSources: [],
    };

    it('signs a refresh JWT, persists its hash, and returns the JWT', async () => {
      jwtService.signAsync.mockResolvedValueOnce('refresh-jwt');
      prisma.user.update.mockResolvedValue(undefined);

      const refreshToken = await service.rotateRefreshToken(authUser as never);

      expect(refreshToken).toBe('refresh-jwt');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', type: 'refresh' },
        {
          secret: 'refresh-secret',
          expiresIn: '30d',
        },
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: hash('refresh-jwt') },
      });
    });
  });

  describe('verifyRefreshToken', () => {
    const refreshJwt = 'current-refresh-jwt';

    it('returns the user when JWT verifies and stored hash matches', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        refreshTokenHash: hash(refreshJwt),
      });

      const result = await service.verifyRefreshToken(refreshJwt);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshJwt, {
        secret: 'refresh-secret',
      });
      expect(result.id).toBe('user-1');
    });

    it('throws when the JWT signature does not verify', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad signature'));

      await expect(service.verifyRefreshToken(refreshJwt)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws when payload.type is not "refresh"', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'access' });

      await expect(service.verifyRefreshToken(refreshJwt)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws when payload.sub is missing', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ type: 'refresh' });

      await expect(service.verifyRefreshToken(refreshJwt)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when the user has no persisted refreshTokenHash (logged out)', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        refreshTokenHash: null,
      });

      await expect(service.verifyRefreshToken(refreshJwt)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws when the stored hash does not match the supplied JWT (timing-safe path)', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'atharva@example.com',
        name: 'Atharva',
        refreshTokenHash: hash('different-jwt'),
      });

      await expect(service.verifyRefreshToken(refreshJwt)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('tryVerifyRefreshToken', () => {
    it('returns the user on the happy path', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        refreshTokenHash: hash('jwt'),
      });

      const result = await service.tryVerifyRefreshToken('jwt');
      expect(result?.id).toBe('user-1');
    });

    it('returns null instead of throwing when verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('expired'));

      await expect(service.tryVerifyRefreshToken('jwt')).resolves.toBeNull();
    });

    it('returns null when the hash mismatches (timing-safe path)', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        refreshTokenHash: hash('other-jwt'),
      });

      await expect(service.tryVerifyRefreshToken('jwt')).resolves.toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('clears the persisted refreshTokenHash', async () => {
      prisma.user.update.mockResolvedValue(undefined);

      await service.revokeRefreshToken('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshTokenHash: null },
      });
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

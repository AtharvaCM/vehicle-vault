import { createHash } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMAIL_VERIFICATION_TTL_MS, PASSWORD_RESET_TTL_MS, TokenService } from './token.service';

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
    authSession: Record<
      'create' | 'updateMany' | 'findUnique' | 'findMany' | 'deleteMany',
      ReturnType<typeof vi.fn>
    >;
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
    authSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
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
    service = new TokenService(prisma as never, appConfigService as never, jwtService as never);
  });

  describe('issueEmailVerification', () => {
    it('persists a hashed token with a 7-day expiry and returns the raw token + url', async () => {
      const now = new Date('2026-05-16T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(now);
      prisma.user.update.mockResolvedValue(undefined);

      const { token, url } = await service.issueEmailVerification('user-1');

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(url).toBe(`https://vehicle-vault-eight.vercel.app/verify-email?token=${token}`);
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
      expect(url).toBe(`https://vehicle-vault-eight.vercel.app/reset-password?token=${token}`);
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

  describe('startSession', () => {
    it('signs a refresh JWT with its own id, and stores its hash on a new session', async () => {
      jwtService.signAsync.mockResolvedValueOnce('refresh.jwt.value');
      prisma.authSession.create.mockResolvedValueOnce({ id: 'session-1' });

      const issued = await service.startSession('user-1', {
        userAgent: 'Mozilla/5.0 Chrome/120',
        location: 'Pune, India',
      });

      expect(issued).toEqual({ sessionId: 'session-1', refreshToken: 'refresh.jwt.value' });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', type: 'refresh', jti: expect.any(String) },
        { secret: 'refresh-secret', expiresIn: '30d' },
      );
      expect(prisma.authSession.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          refreshTokenHash: hash('refresh.jwt.value'),
          userAgent: 'Mozilla/5.0 Chrome/120',
          location: 'Pune, India',
        },
        select: { id: true },
      });
    });

    it('gives two sign-ins in the same second different tokens', async () => {
      prisma.authSession.create.mockResolvedValue({ id: 'session' });
      jwtService.signAsync.mockResolvedValue('jwt');

      await service.startSession('user-1', { userAgent: null, location: null });
      await service.startSession('user-1', { userAgent: null, location: null });

      const [first, second] = jwtService.signAsync.mock.calls.map(([payload]) => payload.jti);
      expect(first).not.toBe(second);
    });
  });

  describe('rotateSession', () => {
    it("replaces the session's hash and marks it active, keeping the device when none is sent", async () => {
      jwtService.signAsync.mockResolvedValueOnce('next.jwt');
      prisma.authSession.updateMany.mockResolvedValueOnce({ count: 1 });

      const issued = await service.rotateSession('user-1', 'session-1');

      expect(issued).toEqual({ sessionId: 'session-1', refreshToken: 'next.jwt' });
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
        data: { refreshTokenHash: hash('next.jwt'), lastActiveAt: expect.any(Date) },
      });
    });

    it('records the device again when the refresh says what it is', async () => {
      jwtService.signAsync.mockResolvedValueOnce('next.jwt');
      prisma.authSession.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.rotateSession('user-1', 'session-1', {
        userAgent: 'Firefox/130',
        location: 'India',
      });

      expect(prisma.authSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userAgent: 'Firefox/130', location: 'India' }),
        }),
      );
    });

    it('refuses a session signed out meanwhile', async () => {
      jwtService.signAsync.mockResolvedValueOnce('next.jwt');
      prisma.authSession.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.rotateSession('user-1', 'gone')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyRefreshToken', () => {
    const user = { id: 'user-1', email: 'a@b.c' };

    it('finds the session by the hash of the token, and returns its user', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.authSession.findUnique.mockResolvedValueOnce({ id: 'session-1', user });

      await expect(service.verifyRefreshToken('refresh.jwt')).resolves.toEqual({
        user,
        sessionId: 'session-1',
      });
      expect(prisma.authSession.findUnique).toHaveBeenCalledWith({
        where: { refreshTokenHash: hash('refresh.jwt') },
        select: { id: true, user: true },
      });
    });

    it('refuses a token whose session was signed out', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.authSession.findUnique.mockResolvedValueOnce(null);

      await expect(service.verifyRefreshToken('refresh.jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses a token whose session belongs to someone else', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-2', type: 'refresh' });
      prisma.authSession.findUnique.mockResolvedValueOnce({ id: 'session-1', user });

      await expect(service.verifyRefreshToken('refresh.jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('refuses a JWT that does not verify, or is not a refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('bad signature'));
      await expect(service.verifyRefreshToken('forged')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'access' });
      await expect(service.verifyRefreshToken('access.jwt')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.authSession.findUnique).not.toHaveBeenCalled();
    });

    it('is lenient through tryVerifyRefreshToken', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', type: 'refresh' });
      prisma.authSession.findUnique.mockResolvedValueOnce(null);

      await expect(service.tryVerifyRefreshToken('refresh.jwt')).resolves.toBeNull();
    });
  });

  describe('revoking sessions', () => {
    it("signs out one of the user's sessions, and says whether there was one", async () => {
      prisma.authSession.deleteMany.mockResolvedValueOnce({ count: 1 });
      await expect(service.revokeSession('user-1', 'session-1')).resolves.toBe(true);
      expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
      });

      prisma.authSession.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.revokeSession('user-1', 'someone-elses')).resolves.toBe(false);
    });

    it('signs out every session, or every one but this', async () => {
      prisma.authSession.deleteMany.mockResolvedValueOnce({ count: 3 });
      await expect(service.revokeSessions('user-1')).resolves.toBe(3);
      expect(prisma.authSession.deleteMany).toHaveBeenLastCalledWith({
        where: { userId: 'user-1' },
      });

      prisma.authSession.deleteMany.mockResolvedValueOnce({ count: 2 });
      await expect(service.revokeSessions('user-1', 'session-1')).resolves.toBe(2);
      expect(prisma.authSession.deleteMany).toHaveBeenLastCalledWith({
        where: { userId: 'user-1', id: { not: 'session-1' } },
      });
    });
  });
});

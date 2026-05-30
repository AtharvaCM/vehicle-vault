import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  type UserDelegateMock = {
    create: ReturnType<typeof vi.fn>;
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

  type AppConfigServiceMock = {
    frontendOrigin: string;
    isProduction: boolean;
    jwtRefreshExpiresIn: string;
    jwtRefreshSecret: string;
  };

  type MailServiceMock = {
    isConfigured: boolean;
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
    sendVerificationEmail: ReturnType<typeof vi.fn>;
  };

  type TokenServiceMock = {
    issueEmailVerification: ReturnType<typeof vi.fn>;
    consumeEmailVerification: ReturnType<typeof vi.fn>;
    issuePasswordReset: ReturnType<typeof vi.fn>;
    consumePasswordReset: ReturnType<typeof vi.fn>;
    rotateRefreshToken: ReturnType<typeof vi.fn>;
    verifyRefreshToken: ReturnType<typeof vi.fn>;
    tryVerifyRefreshToken: ReturnType<typeof vi.fn>;
    revokeRefreshToken: ReturnType<typeof vi.fn>;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    user: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const jwtService: JwtServiceMock = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  const appConfigService: AppConfigServiceMock = {
    frontendOrigin: 'https://vehicle-vault-eight.vercel.app',
    isProduction: false,
    jwtRefreshExpiresIn: '30d',
    jwtRefreshSecret: 'refresh-secret',
  };

  const mailService: MailServiceMock = {
    isConfigured: false,
    sendPasswordResetEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
  };

  const tokenService: TokenServiceMock = {
    issueEmailVerification: vi.fn(),
    consumeEmailVerification: vi.fn(),
    issuePasswordReset: vi.fn(),
    consumePasswordReset: vi.fn(),
    rotateRefreshToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
    tryVerifyRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
  };

  const auditService = {
    track: vi.fn().mockResolvedValue(undefined),
    anonymiseForUser: vi.fn().mockResolvedValue(undefined),
  };

  const passwordResetExpiresAt = new Date('2026-03-20T00:30:00.000Z');

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    appConfigService.isProduction = false;
    mailService.isConfigured = false;
    mailService.sendPasswordResetEmail.mockResolvedValue(undefined);
    mailService.sendVerificationEmail.mockResolvedValue(undefined);
    tokenService.issueEmailVerification.mockResolvedValue({
      token: 'verification-token',
      url: 'https://vehicle-vault-eight.vercel.app/verify-email?token=verification-token',
      expiresAt: new Date('2026-03-27T00:00:00.000Z'),
    });
    tokenService.consumeEmailVerification.mockResolvedValue({
      id: 'user-1',
      email: 'atharva@example.com',
      name: 'Atharva',
    });
    tokenService.issuePasswordReset.mockResolvedValue({
      token: 'reset-token',
      url: 'https://vehicle-vault-eight.vercel.app/reset-password?token=reset-token',
      expiresAt: passwordResetExpiresAt,
    });
    tokenService.consumePasswordReset.mockResolvedValue({
      id: 'user-1',
      email: 'atharva@example.com',
      name: 'Atharva',
    });
    tokenService.rotateRefreshToken.mockResolvedValue('refresh-token');
    tokenService.tryVerifyRefreshToken.mockResolvedValue(null);
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);
    auditService.track.mockResolvedValue(undefined);
    service = new AuthService(
      prisma as never,
      jwtService as never,
      appConfigService as never,
      mailService as never,
      tokenService as never,
      auditService as never,
    );
  });

  it('registers a user with normalized data and returns access and refresh tokens', async () => {
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.signAsync.mockResolvedValueOnce('access-token');
    tokenService.rotateRefreshToken.mockResolvedValue('refresh-token');

    const result = await service.register({
      name: '  Atharva  ',
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Atharva',
        email: 'atharva@example.com',
        emailVerified: false,
      }),
    });
    expect(prisma.user.create.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      'emailVerificationTokenHash',
    );
    expect(prisma.user.create.mock.calls[0]?.[0]?.data.passwordHash).not.toBe('password123');
    expect(tokenService.issueEmailVerification).toHaveBeenCalledWith('user-1');
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'atharva@example.com',
        name: 'Atharva',
        verificationUrl:
          'https://vehicle-vault-eight.vercel.app/verify-email?token=verification-token',
      }),
    );
    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', email: 'atharva@example.com' }),
    );
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
        role: 'user',
        allowedCatalogSources: [],
        emailVerified: false,
      },
    });
  });

  it('returns conflict for duplicate emails on register', async () => {
    prisma.user.create = vi.fn().mockRejectedValue(
      new PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'vitest',
      }),
    );

    await expect(
      service.register({
        name: 'Atharva',
        email: 'atharva@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid credentials on login when the email is unknown', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.login({
        email: 'atharva@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logs in a user with a valid password and rotates refresh state', async () => {
    const passwordHash = await import('bcryptjs').then(({ hash }) => hash('password123', 12));

    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      passwordHash,
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.signAsync.mockResolvedValueOnce('access-token');
    tokenService.rotateRefreshToken.mockResolvedValue('refresh-token');

    const result = await service.login({
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'atharva@example.com',
      },
    });
    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('refreshes the session via TokenService.verifyRefreshToken and rotates the refresh credential', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.signAsync.mockResolvedValueOnce('next-access-token');
    tokenService.rotateRefreshToken.mockResolvedValue('next-refresh-token');

    const result = await service.refresh({
      refreshToken: 'current-refresh-token',
    });

    expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('current-refresh-token');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
    );
    expect(result).toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
        role: 'user',
        allowedCatalogSources: [],
        emailVerified: false,
      },
    });
  });

  it('rejects refresh when TokenService.verifyRefreshToken throws', async () => {
    tokenService.verifyRefreshToken.mockRejectedValueOnce(
      new UnauthorizedException('Invalid refresh token.'),
    );

    await expect(
      service.refresh({
        refreshToken: 'current-refresh-token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('clears the stored refresh token hash on logout', async () => {
    tokenService.tryVerifyRefreshToken.mockResolvedValueOnce({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      refreshTokenHash: 'stored-refresh-hash',
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      service.logout({
        refreshToken: 'current-refresh-token',
      }),
    ).resolves.toBeUndefined();

    expect(tokenService.tryVerifyRefreshToken).toHaveBeenCalledWith('current-refresh-token');
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith('user-1');
  });

  it('silently no-ops on logout when TokenService rejects the refresh token', async () => {
    tokenService.tryVerifyRefreshToken.mockResolvedValueOnce(null);

    await expect(
      service.logout({
        refreshToken: 'bogus-token',
      }),
    ).resolves.toBeUndefined();

    expect(tokenService.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('delegates issuance to TokenService and returns the preview token outside production', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.requestPasswordReset({
      email: ' ATHARVA@example.com ',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'atharva@example.com',
      },
    });
    expect(tokenService.issuePasswordReset).toHaveBeenCalledWith('user-1');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      accepted: true,
      previewToken: 'reset-token',
      expiresAt: passwordResetExpiresAt.toISOString(),
    });
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends a real password reset email in production using the TokenService url', async () => {
    appConfigService.isProduction = true;
    mailService.isConfigured = true;
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });

    const result = await service.requestPasswordReset({
      email: 'atharva@example.com',
    });

    expect(result).toEqual({
      accepted: true,
    });
    expect(tokenService.issuePasswordReset).toHaveBeenCalledWith('user-1');
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith({
      email: 'atharva@example.com',
      name: 'Atharva',
      resetUrl: 'https://vehicle-vault-eight.vercel.app/reset-password?token=reset-token',
      expiresAt: passwordResetExpiresAt,
    });
  });

  it('fails password reset requests in production when email delivery is not configured', async () => {
    appConfigService.isProduction = true;
    mailService.isConfigured = false;

    await expect(
      service.requestPasswordReset({
        email: 'atharva@example.com',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns a generic password reset acceptance when the email does not exist', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.requestPasswordReset({
        email: 'missing@example.com',
      }),
    ).resolves.toEqual({
      accepted: true,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('consumes the reset token via TokenService and revokes the refresh session', async () => {
    prisma.user.update = vi.fn().mockResolvedValue(undefined);

    const result = await service.resetPassword({
      token: 'valid-reset-token',
      password: 'updated-password123',
    });

    expect(tokenService.consumePasswordReset).toHaveBeenCalledWith('valid-reset-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        passwordHash: expect.any(String),
        refreshTokenHash: null,
      },
    });
    expect(prisma.user.update.mock.calls[0]?.[0]?.data.passwordHash).not.toBe(
      'updated-password123',
    );
    expect(result).toEqual({
      reset: true,
    });
  });

  it('rejects password reset when TokenService rejects the token', async () => {
    tokenService.consumePasswordReset.mockRejectedValueOnce(
      new UnauthorizedException('Invalid or expired password reset token.'),
    );

    await expect(
      service.resetPassword({
        token: 'invalid-token',
        password: 'updated-password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('delegates email verification to TokenService.consumeEmailVerification', async () => {
    await expect(
      service.verifyEmail({ token: 'verification-token' }),
    ).resolves.toEqual({ verified: true });

    expect(tokenService.consumeEmailVerification).toHaveBeenCalledWith('verification-token');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns accepted=true silently when resendVerification targets an unknown email', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue(null);

    await expect(
      service.resendVerification({ email: 'unknown@example.com' }),
    ).resolves.toEqual({ accepted: true });

    expect(tokenService.issueEmailVerification).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns accepted=true silently when resendVerification targets an already-verified user', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      emailVerified: true,
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      service.resendVerification({ email: 'atharva@example.com' }),
    ).resolves.toEqual({ accepted: true });

    expect(tokenService.issueEmailVerification).not.toHaveBeenCalled();
    expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('issues a fresh verification token and sends mail on resendVerification', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
    });

    await expect(
      service.resendVerification({ email: ' ATHARVA@example.com ' }),
    ).resolves.toEqual({ accepted: true });

    expect(tokenService.issueEmailVerification).toHaveBeenCalledWith('user-1');
    expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'atharva@example.com',
        name: 'Atharva',
        verificationUrl:
          'https://vehicle-vault-eight.vercel.app/verify-email?token=verification-token',
      }),
    );
  });

  it('returns the authenticated user from getMe', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });

    await expect(service.getMe('user-1')).resolves.toEqual({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      role: 'user',
      allowedCatalogSources: [],
      emailVerified: false,
    });
  });
});

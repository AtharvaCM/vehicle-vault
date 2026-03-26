import { createHash } from 'node:crypto';

import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

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
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    appConfigService.isProduction = false;
    mailService.isConfigured = false;
    mailService.sendPasswordResetEmail.mockResolvedValue(undefined);
    service = new AuthService(
      prisma as never,
      jwtService as never,
      appConfigService as never,
      mailService as never,
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
    prisma.user.update = vi.fn().mockResolvedValue(undefined);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.register({
      name: '  Atharva  ',
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Atharva',
        email: 'atharva@example.com',
      }),
    });
    expect(prisma.user.create.mock.calls[0]?.[0]?.data.passwordHash).not.toBe('password123');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        refreshTokenHash: hashRefreshToken('refresh-token'),
      },
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
        allowedCatalogSources: [],
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
    prisma.user.update = vi.fn().mockResolvedValue(undefined);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    const result = await service.login({
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'atharva@example.com',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        refreshTokenHash: hashRefreshToken('refresh-token'),
      },
    });
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('refreshes the session when the supplied refresh token matches the stored hash', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      refreshTokenHash: hashRefreshToken('current-refresh-token'),
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update = vi.fn().mockResolvedValue(undefined);
    jwtService.verifyAsync = vi.fn().mockResolvedValue({
      sub: 'user-1',
      type: 'refresh',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('next-access-token')
      .mockResolvedValueOnce('next-refresh-token');

    const result = await service.refresh({
      refreshToken: 'current-refresh-token',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        refreshTokenHash: hashRefreshToken('next-refresh-token'),
      },
    });
    expect(result).toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      user: {
        id: 'user-1',
        name: 'Atharva',
        email: 'atharva@example.com',
        allowedCatalogSources: [],
      },
    });
  });

  it('rejects refresh when the token hash does not match the stored session', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      refreshTokenHash: hashRefreshToken('different-token'),
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.verifyAsync = vi.fn().mockResolvedValue({
      sub: 'user-1',
      type: 'refresh',
    });

    await expect(
      service.refresh({
        refreshToken: 'current-refresh-token',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('clears the stored refresh token hash on logout', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      refreshTokenHash: hashRefreshToken('current-refresh-token'),
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update = vi.fn().mockResolvedValue(undefined);
    jwtService.verifyAsync = vi.fn().mockResolvedValue({
      sub: 'user-1',
      type: 'refresh',
    });

    await expect(
      service.logout({
        refreshToken: 'current-refresh-token',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: {
        refreshTokenHash: null,
      },
    });
  });

  it('creates a password reset token preview for existing users outside production', async () => {
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update = vi.fn().mockResolvedValue(undefined);

    const result = await service.requestPasswordReset({
      email: ' ATHARVA@example.com ',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'atharva@example.com',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: expect.objectContaining({
        passwordResetTokenExpiresAt: expect.any(Date),
        passwordResetTokenHash: expect.any(String),
      }),
    });
    expect(result.accepted).toBe(true);
    expect(result.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expiresAt).toBeDefined();
    expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends a real password reset email in production when smtp is configured', async () => {
    appConfigService.isProduction = true;
    mailService.isConfigured = true;
    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update = vi.fn().mockResolvedValue(undefined);

    const result = await service.requestPasswordReset({
      email: 'atharva@example.com',
    });

    expect(result).toEqual({
      accepted: true,
    });
    expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'atharva@example.com',
        name: 'Atharva',
        resetUrl: expect.stringContaining(
          'https://vehicle-vault-eight.vercel.app/reset-password?token=',
        ),
      }),
    );
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

  it('resets the password with a valid reset token and revokes refresh sessions', async () => {
    prisma.user.findFirst = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      passwordResetTokenHash: hashPasswordResetToken('valid-reset-token'),
      passwordResetTokenExpiresAt: new Date('2026-03-22T00:00:00.000Z'),
      refreshTokenHash: hashRefreshToken('current-refresh-token'),
      createdAt,
      updatedAt: createdAt,
    });
    prisma.user.update = vi.fn().mockResolvedValue(undefined);

    const result = await service.resetPassword({
      token: 'valid-reset-token',
      password: 'updated-password123',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        passwordResetTokenExpiresAt: {
          gt: expect.any(Date),
        },
        passwordResetTokenHash: hashPasswordResetToken('valid-reset-token'),
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
      },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        passwordResetTokenExpiresAt: null,
        passwordResetTokenHash: null,
        refreshTokenHash: null,
      }),
    });
    expect(result).toEqual({
      reset: true,
    });
  });

  it('rejects password reset when the reset token is invalid or expired', async () => {
    prisma.user.findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      service.resetPassword({
        token: 'invalid-token',
        password: 'updated-password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
      allowedCatalogSources: [],
    });
  });
});

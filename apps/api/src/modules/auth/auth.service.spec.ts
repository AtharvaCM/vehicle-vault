import { createHash } from 'node:crypto';

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('hex');
}

describe('AuthService', () => {
  type UserDelegateMock = {
    create: ReturnType<typeof vi.fn>;
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
    jwtRefreshExpiresIn: string;
    jwtRefreshSecret: string;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };

  const jwtService: JwtServiceMock = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  const appConfigService: AppConfigServiceMock = {
    jwtRefreshExpiresIn: '30d',
    jwtRefreshSecret: 'refresh-secret',
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prisma as never, jwtService as never, appConfigService as never);
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
    });
  });
});

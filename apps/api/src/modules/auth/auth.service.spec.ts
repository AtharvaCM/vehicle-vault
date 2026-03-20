import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  type UserDelegateMock = {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };

  type PrismaMock = {
    user: UserDelegateMock;
  };

  type JwtServiceMock = {
    signAsync: ReturnType<typeof vi.fn>;
  };

  const createdAt = new Date('2026-03-20T00:00:00.000Z');

  const prisma: PrismaMock = {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const jwtService: JwtServiceMock = {
    signAsync: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(prisma, jwtService as never);
  });

  it('registers a user with normalized data and returns an auth response', async () => {
    prisma.user.create = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.register({
      name: '  Atharva  ',
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Atharva',
        email: 'atharva@example.com',
      }),
    });
    expect(prisma.user.create.mock.calls[0]?.[0]?.data.passwordHash).not.toBe('password123');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'atharva@example.com',
      name: 'Atharva',
    });
    expect(result).toEqual({
      accessToken: 'jwt-token',
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

  it('logs in a user with a valid password', async () => {
    const passwordHash = await import('bcryptjs').then(({ hash }) => hash('password123', 12));

    prisma.user.findUnique = vi.fn().mockResolvedValue({
      id: 'user-1',
      name: 'Atharva',
      email: 'atharva@example.com',
      passwordHash,
      createdAt,
      updatedAt: createdAt,
    });
    jwtService.signAsync.mockResolvedValue('jwt-token');

    const result = await service.login({
      email: '  ATHARVA@example.com ',
      password: 'password123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: 'atharva@example.com',
      },
    });
    expect(result.accessToken).toBe('jwt-token');
    expect(result.user.email).toBe('atharva@example.com');
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

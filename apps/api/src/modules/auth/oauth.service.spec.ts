import { OAuthProvider } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthService, type OAuthProfile } from './oauth.service';

function basePrisma() {
  return {
    oAuthAccount: { findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  };
}

function baseUser() {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    emailVerified: true,
    allowedCatalogSources: [] as string[],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('OAuthService.loginOrLink', () => {
  let prisma: ReturnType<typeof basePrisma>;
  const tokenService = { rotateRefreshToken: vi.fn() };
  const jwtService = { signAsync: vi.fn() };
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };
  let service: OAuthService;

  beforeEach(() => {
    prisma = basePrisma();
    tokenService.rotateRefreshToken.mockReset();
    jwtService.signAsync.mockReset();
    auditService.track.mockReset();
    auditService.track.mockResolvedValue(undefined);
    tokenService.rotateRefreshToken.mockResolvedValue('refresh-token');
    jwtService.signAsync.mockResolvedValue('access-token');
    service = new OAuthService(
      prisma as never,
      tokenService as never,
      jwtService as never,
      auditService as never,
    );
  });

  const profile: OAuthProfile = {
    provider: OAuthProvider.google,
    providerAccountId: 'google-123',
    email: 'alice@example.com',
    name: 'Alice',
    emailVerified: true,
  };

  it('returns auth response when account is already linked', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue({ user: baseUser() });

    const response = await service.loginOrLink(profile);

    expect(response.accessToken).toBe('access-token');
    expect(response.user.email).toBe('alice@example.com');
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
  });

  it('links existing user by verified email when no account is linked yet', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    const existing = { ...baseUser(), emailVerified: false };
    prisma.user.findUnique.mockResolvedValue(existing);
    prisma.user.update.mockResolvedValue({ ...existing, emailVerified: true });

    const response = await service.loginOrLink(profile);

    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: OAuthProvider.google,
        providerAccountId: 'google-123',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailVerified: true },
    });
    expect(response.user.emailVerified).toBe(true);
  });

  it('skips email-link when provider email is not verified', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(baseUser());
    prisma.user.create.mockResolvedValue({
      ...baseUser(),
      id: 'user-2',
      email: 'alice@example.com',
    });

    await service.loginOrLink({ ...profile, emailVerified: false });

    expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it('creates a new user when no link or email match exists', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      ...baseUser(),
      id: 'user-99',
      email: 'newby@example.com',
      name: 'Newby',
    });

    const response = await service.loginOrLink({
      ...profile,
      email: 'newby@example.com',
      name: 'Newby',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Newby',
        email: 'newby@example.com',
        passwordHash: null,
        emailVerified: true,
        oauthAccounts: {
          create: {
            provider: OAuthProvider.google,
            providerAccountId: 'google-123',
          },
        },
      },
    });
    expect(response.user.id).toBe('user-99');
  });
});

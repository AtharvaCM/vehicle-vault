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
  const productEvents = { record: vi.fn(), recordFirst: vi.fn() };
  let prisma: ReturnType<typeof basePrisma>;
  const tokenService = { startSession: vi.fn() };
  const jwtService = { signAsync: vi.fn() };
  const auditService = { track: vi.fn().mockResolvedValue(undefined) };
  let service: OAuthService;

  beforeEach(() => {
    prisma = basePrisma();
    tokenService.startSession.mockReset();
    jwtService.signAsync.mockReset();
    auditService.track.mockReset();
    auditService.track.mockResolvedValue(undefined);
    tokenService.startSession.mockResolvedValue({
      sessionId: 'session-1',
      refreshToken: 'refresh-token',
    });
    jwtService.signAsync.mockResolvedValue('access-token');
    service = new OAuthService(
      prisma as never,
      tokenService as never,
      jwtService as never,
      auditService as never,
      productEvents as never,
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
    expect(response.refreshToken).toBe('refresh-token');
    expect(response.user.email).toBe('alice@example.com');
    // Its own session, named in the access token, as a password sign-in gets.
    expect(tokenService.startSession).toHaveBeenCalledWith('user-1', {
      userAgent: null,
      location: null,
    });
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
    // Linking an existing account is not a new account.
    expect(productEvents.record).not.toHaveBeenCalled();
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
    expect(response.user.emailVerificationDueAt).toBeNull();
  });

  it('never gives an account created without an email a verification deadline', async () => {
    const noEmail: OAuthProfile = {
      provider: OAuthProvider.github,
      providerAccountId: '4242',
      email: null,
      name: 'Private Email',
      emailVerified: false,
    };
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...baseUser(),
      id: 'user-100',
      name: data.name,
      email: data.email,
      emailVerified: data.emailVerified,
    }));

    const response = await service.loginOrLink(noEmail);

    // A placeholder with no inbox behind it: asking for verification would lock the account.
    expect(response.user.email).toBe('github-4242@oauth.local');
    expect(response.user.emailVerified).toBe(false);
    expect(response.user.emailVerificationDueAt).toBeNull();
  });

  it('records a new OAuth account with its provider as the method', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ ...baseUser(), id: 'user-99' });

    await service.loginOrLink(profile);

    expect(productEvents.record).toHaveBeenCalledWith(prisma, {
      name: 'account_created',
      userId: 'user-99',
      properties: { method: 'google' },
    });
  });

  describe('catalog attribution', () => {
    const fromCatalog = { catalogModel: 'city' };

    beforeEach(() => {
      productEvents.record.mockClear();
    });

    it('attributes an account created from a catalog page to the catalog and its model', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser(), id: 'user-99' });

      await service.loginOrLink({ ...profile, provider: OAuthProvider.github }, fromCatalog);

      expect(productEvents.record).toHaveBeenCalledOnce();
      expect(productEvents.record).toHaveBeenCalledWith(prisma, {
        name: 'account_created',
        userId: 'user-99',
        properties: { method: 'github', source: 'catalog', catalogModel: 'city' },
      });
    });

    it('records no source for a new account that did not come from a catalog page', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...baseUser(), id: 'user-99' });

      await service.loginOrLink(profile, {});

      expect(productEvents.record).toHaveBeenCalledWith(prisma, {
        name: 'account_created',
        userId: 'user-99',
        properties: { method: 'google' },
      });
    });

    it('records nothing when an existing linked user signs in from a catalog page', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({ user: baseUser() });

      const response = await service.loginOrLink(profile, fromCatalog);

      expect(response.accessToken).toBe('access-token');
      expect(productEvents.record).not.toHaveBeenCalled();
    });

    it('records nothing when a catalog sign-in links an existing account by email', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(baseUser());

      await service.loginOrLink(profile, fromCatalog);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(productEvents.record).not.toHaveBeenCalled();
    });
  });
});

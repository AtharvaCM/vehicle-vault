import { OAuthProvider } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthController } from './oauth.controller';
import type { OAuthProfile } from './oauth.service';

const FRONTEND = 'https://app.example.test/auth/oauth-callback';

const profile: OAuthProfile = {
  provider: OAuthProvider.google,
  providerAccountId: 'google-1',
  email: 'asha@example.test',
  name: 'Asha',
  emailVerified: true,
};

describe('OAuthController callback', () => {
  const oauthService = { loginOrLink: vi.fn() };
  const res = { redirect: vi.fn() };
  let controller: OAuthController;

  beforeEach(() => {
    oauthService.loginOrLink.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    controller = new OAuthController(
      oauthService as never,
      { oauthFrontendRedirectUrl: FRONTEND } as never,
    );
  });

  function fragment() {
    const url = new URL(res.redirect.mock.calls[0]![0] as string);
    expect(`${url.origin}${url.pathname}`).toBe(FRONTEND);
    return Object.fromEntries(new URLSearchParams(url.hash.slice(1)));
  }

  it('passes the model a verified state carried on to the sign-in', async () => {
    await controller.googleCallback(
      { user: profile, authInfo: { state: { catalogModel: 'city' } } },
      res,
    );

    expect(oauthService.loginOrLink).toHaveBeenCalledWith(
      profile,
      { catalogModel: 'city' },
      { userAgent: null, location: null },
    );
    expect(fragment()).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('passes no model when the state carried none', async () => {
    await controller.githubCallback({ user: profile, authInfo: { state: {} } }, res);

    expect(oauthService.loginOrLink).toHaveBeenCalledWith(
      profile,
      { catalogModel: undefined },
      { userAgent: null, location: null },
    );
  });

  it('ignores anything in authInfo that is not a catalog slug', async () => {
    for (const authInfo of [
      undefined,
      { state: { catalogModel: 'Not A Slug' } },
      { state: { catalogModel: ['city'] } },
      { state: 'city' },
    ]) {
      oauthService.loginOrLink.mockClear();

      await controller.googleCallback({ user: profile, authInfo }, res);

      expect(oauthService.loginOrLink).toHaveBeenCalledWith(
        profile,
        { catalogModel: undefined },
        { userAgent: null, location: null },
      );
    }
  });

  it('hands the return path a verified state carried back to the web app', async () => {
    await controller.googleCallback(
      { user: profile, authInfo: { state: { next: '/vehicle-invites/tok-1' } } },
      res,
    );

    expect(fragment()).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      next: '/vehicle-invites/tok-1',
    });
  });

  it('never hands back a return path that leaves the site', async () => {
    await controller.googleCallback(
      { user: profile, authInfo: { state: { next: '//evil.example.test' } } },
      res,
    );

    expect(fragment()).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('keeps the return path on a failed sign-in so the retry still has it', async () => {
    oauthService.loginOrLink.mockRejectedValueOnce(new Error('oauth_email_conflict'));

    await controller.githubCallback(
      { user: profile, authInfo: { state: { next: '/reminders' } } },
      res,
    );

    expect(fragment()).toEqual({ error: 'oauth_email_conflict', next: '/reminders' });
  });

  it('sends a cancelled or refused sign-in back to the web app with its reason', async () => {
    await controller.googleCallback({ oauthFailure: 'oauth_cancelled' }, res);

    expect(oauthService.loginOrLink).not.toHaveBeenCalled();
    expect(fragment()).toEqual({ error: 'oauth_cancelled' });
  });

  it('still reports a callback with no profile and no known reason', async () => {
    await controller.googleCallback({}, res);

    expect(fragment()).toEqual({ error: 'oauth_no_profile' });
  });
});

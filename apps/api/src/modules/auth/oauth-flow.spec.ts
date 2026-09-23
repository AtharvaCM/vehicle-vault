import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { OAuthCallbackGuard, type OAuthCallbackRequest } from './oauth-callback.guard';
import { OAUTH_STATE_COOKIE } from './oauth-state';
import { GithubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';

/**
 * The OAuth state through the real passport-oauth2 strategies and the Nest
 * guards: begin sets the cookie and a signed state, the callback verifies both
 * before the code is exchanged and hands the model on as `authInfo.state`.
 * Only the provider's token and profile calls are stubbed.
 */

const API = 'https://api.example.test/api/auth/oauth';

const config = {
  jwtSecret: 'flow-secret',
  oauthGoogleClientId: 'google-client',
  oauthGoogleClientSecret: 'google-client-secret',
  oauthGoogleCallbackUrl: `${API}/google/callback`,
  oauthGithubClientId: 'github-client',
  oauthGithubClientSecret: 'github-client-secret',
  oauthGithubCallbackUrl: `${API}/github/callback`,
};

type Stubbed = {
  _oauth2: { getOAuthAccessToken: (...args: unknown[]) => void };
  userProfile: (token: string, done: (err: unknown, profile?: unknown) => void) => void;
};

function stubProvider(strategy: unknown, profile: Record<string, unknown>) {
  const stubbed = strategy as Stubbed;
  const exchange = vi.fn((_code: unknown, _params: unknown, callback: unknown) =>
    (callback as (...args: unknown[]) => void)(null, 'provider-access', 'provider-refresh', {}),
  );
  stubbed._oauth2.getOAuthAccessToken = exchange;
  stubbed.userProfile = (_token, done) => done(null, profile);
  return exchange;
}

const strategies = {
  google: stubProvider(new GoogleStrategy(config as never), {
    id: 'google-1',
    displayName: 'Asha',
    emails: [{ value: 'asha@example.test' }],
  }),
  github: stubProvider(new GithubStrategy(config as never), {
    id: 4242,
    displayName: 'Ravi',
    username: 'ravi',
    emails: [{ value: 'ravi@example.test', primary: true, verified: true }],
  }),
};

type FakeRequest = OAuthCallbackRequest & {
  query: Record<string, unknown>;
  headers: Record<string, string>;
  res: FakeResponse;
  url: string;
};

type FakeResponse = ReturnType<typeof fakeResponse>;

function fakeResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    headers,
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    setHeader: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    end: vi.fn(),
  };
}

function fakeRequest(query: Record<string, unknown>, cookie?: string): FakeRequest {
  const res = fakeResponse();
  return {
    query,
    headers: cookie ? { cookie } : {},
    res,
    url: '/',
  };
}

function contextFor(req: FakeRequest) {
  return {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => req.res }),
  } as unknown as ExecutionContext;
}

async function begin(provider: OAuthProvider, query: Record<string, unknown> = {}) {
  const req = fakeRequest(query);
  const Guard = AuthGuard(provider);
  // Resolves only through passport's callback, which a redirect never calls.
  void new Guard().canActivate(contextFor(req));
  await vi.waitFor(() => expect(req.res.end).toHaveBeenCalled());

  const location = new URL(req.res.headers.get('location') ?? '');
  const [, nonce] = req.res.cookie.mock.calls[0] as [string, string];
  return { location, state: location.searchParams.get('state') ?? '', nonce };
}

async function callback(provider: OAuthProvider, query: Record<string, unknown>, cookie?: string) {
  const req = fakeRequest(query, cookie);
  const Guard = OAuthCallbackGuard(provider);
  await new Guard().canActivate(contextFor(req));
  return req;
}

describe.each([OAuthProvider.google, OAuthProvider.github])('OAuth state with %s', (provider) => {
  it('sends the visitor to the provider with a signed state and sets its cookie', async () => {
    const started = await begin(provider, { catalogModel: 'city' });

    expect(started.location.searchParams.get('redirect_uri')).toBe(`${API}/${provider}/callback`);
    expect(started.state).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(started.nonce).toBeTruthy();
  });

  it('hands the catalog model to the callback once state and cookie agree', async () => {
    const started = await begin(provider, { catalogModel: 'city' });

    const req = await callback(
      provider,
      { code: 'provider-code', state: started.state },
      `${OAUTH_STATE_COOKIE}=${started.nonce}`,
    );

    expect(req.user).toMatchObject({ provider });
    expect(req.authInfo).toEqual({ state: { catalogModel: 'city' } });
    expect(req.oauthFailure).toBeUndefined();
  });

  it('signs in with no model when sign-in began without one', async () => {
    const started = await begin(provider);

    const req = await callback(
      provider,
      { code: 'provider-code', state: started.state },
      `${OAUTH_STATE_COOKIE}=${started.nonce}`,
    );

    expect(req.user).toMatchObject({ provider });
    expect(req.authInfo).toEqual({ state: {} });
  });

  it('refuses a tampered state before exchanging the code', async () => {
    const started = await begin(provider, { catalogModel: 'city' });
    const [body, signature] = started.state.split('.');
    const decoded = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8'));
    const forged = `${Buffer.from(JSON.stringify({ ...decoded, m: 'nexon' })).toString('base64url')}.${signature}`;
    strategies[provider].mockClear();

    const req = await callback(
      provider,
      { code: 'provider-code', state: forged },
      `${OAUTH_STATE_COOKIE}=${started.nonce}`,
    );

    expect(req.user).toBeUndefined();
    expect(req.oauthFailure).toBe('oauth_state_invalid');
    expect(strategies[provider]).not.toHaveBeenCalled();
  });

  it('refuses a genuine state arriving in a browser without its cookie', async () => {
    const started = await begin(provider, { catalogModel: 'city' });
    strategies[provider].mockClear();

    const req = await callback(provider, { code: 'provider-code', state: started.state });

    expect(req.user).toBeUndefined();
    expect(req.oauthFailure).toBe('oauth_state_invalid');
    expect(strategies[provider]).not.toHaveBeenCalled();
  });

  it('reports a sign-in cancelled at the provider without throwing', async () => {
    const started = await begin(provider, { catalogModel: 'city' });

    const req = await callback(
      provider,
      { error: 'access_denied', state: started.state },
      `${OAUTH_STATE_COOKIE}=${started.nonce}`,
    );

    expect(req.user).toBeUndefined();
    expect(req.oauthFailure).toBe('oauth_cancelled');
  });
});

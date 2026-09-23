import { OAuthProvider } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_INVALID,
  OAUTH_STATE_TTL_MS,
  OAuthStateStore,
  readOAuthState,
  signOAuthState,
  type OAuthStateRequest,
} from './oauth-state';

const SECRET = 'test-secret';
const NOW = Date.UTC(2026, 8, 23, 10, 0, 0);
const CALLBACK = 'https://api.example.test/api/auth/oauth/google/callback';

function payload(overrides: Partial<Parameters<typeof signOAuthState>[0]> = {}) {
  return {
    provider: OAuthProvider.google,
    nonce: 'nonce-1',
    expiresAt: NOW + OAUTH_STATE_TTL_MS,
    catalogModel: 'city',
    ...overrides,
  };
}

const expectGoogle = { provider: OAuthProvider.google, now: NOW };

/** Swaps the signed JSON for another, keeping the original signature. */
function withBody(state: string, body: Record<string, unknown>) {
  const [, signature] = state.split('.');
  return `${Buffer.from(JSON.stringify(body)).toString('base64url')}.${signature}`;
}

function decodeBody(state: string) {
  return JSON.parse(Buffer.from(state.split('.')[0]!, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

describe('signOAuthState / readOAuthState', () => {
  it('round-trips the provider, nonce, expiry and catalog model', () => {
    const state = signOAuthState(payload(), SECRET);

    expect(readOAuthState(state, SECRET, expectGoogle)).toEqual(payload());
  });

  it('round-trips a state with no catalog model', () => {
    const state = signOAuthState(payload({ catalogModel: undefined }), SECRET);

    expect(readOAuthState(state, SECRET, expectGoogle)).toEqual({
      provider: OAuthProvider.google,
      nonce: 'nonce-1',
      expiresAt: NOW + OAUTH_STATE_TTL_MS,
    });
  });

  it('never signs a model that is not a catalog slug', () => {
    for (const catalogModel of ['City', 'city car', 'a@b.example.test', '-city', 'x'.repeat(121)]) {
      const state = signOAuthState(payload({ catalogModel }), SECRET);

      expect(decodeBody(state)).not.toHaveProperty('m');
      expect(readOAuthState(state, SECRET, expectGoogle)?.catalogModel).toBeUndefined();
    }
  });

  it('refuses a state whose model was swapped after signing', () => {
    const state = signOAuthState(payload(), SECRET);
    const tampered = withBody(state, { ...decodeBody(state), m: 'nexon' });

    expect(readOAuthState(tampered, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a state whose model was added after signing', () => {
    const state = signOAuthState(payload({ catalogModel: undefined }), SECRET);
    const tampered = withBody(state, { ...decodeBody(state), m: 'city' });

    expect(readOAuthState(tampered, SECRET, expectGoogle)).toBeNull();
  });

  it('round-trips a return path', () => {
    const state = signOAuthState(payload({ next: '/vehicle-invites/abc?x=1' }), SECRET);

    expect(readOAuthState(state, SECRET, expectGoogle)?.next).toBe('/vehicle-invites/abc?x=1');
  });

  it('never signs a return path that leaves the site', () => {
    for (const next of [
      'https://evil.example.test/',
      '//evil.example.test',
      '/\\evil.example.test',
    ]) {
      const state = signOAuthState(payload({ next }), SECRET);

      expect(decodeBody(state)).not.toHaveProperty('r');
    }
  });

  it('refuses a state whose return path was swapped after signing', () => {
    const state = signOAuthState(payload({ next: '/dashboard' }), SECRET);
    const tampered = withBody(state, { ...decodeBody(state), r: '/vehicles' });

    expect(readOAuthState(tampered, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a state whose expiry was pushed out after signing', () => {
    const state = signOAuthState(payload(), SECRET);
    const tampered = withBody(state, { ...decodeBody(state), e: NOW + 365 * OAUTH_STATE_TTL_MS });

    expect(readOAuthState(tampered, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a changed signature', () => {
    const state = signOAuthState(payload(), SECRET);
    const [body, signature] = state.split('.');
    const flipped = `${signature!.slice(0, -1)}${signature!.endsWith('A') ? 'B' : 'A'}`;

    expect(readOAuthState(`${body}.${flipped}`, SECRET, expectGoogle)).toBeNull();
    expect(readOAuthState(`${body}.`, SECRET, expectGoogle)).toBeNull();
    expect(readOAuthState(body, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a state signed with another secret', () => {
    const state = signOAuthState(payload(), 'someone-elses-secret');

    expect(readOAuthState(state, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a state minted for another provider', () => {
    const state = signOAuthState(payload({ provider: OAuthProvider.github }), SECRET);

    expect(readOAuthState(state, SECRET, expectGoogle)).toBeNull();
  });

  it('refuses a state past its expiry, and accepts it up to that moment', () => {
    const state = signOAuthState(payload(), SECRET);

    expect(
      readOAuthState(state, SECRET, { ...expectGoogle, now: NOW + OAUTH_STATE_TTL_MS }),
    ).not.toBeNull();
    expect(
      readOAuthState(state, SECRET, { ...expectGoogle, now: NOW + OAUTH_STATE_TTL_MS + 1 }),
    ).toBeNull();
  });

  it('refuses anything that is not a state', () => {
    for (const value of [undefined, null, 42, '', '.', 'a.b.c', 'not-a-state', 'x'.repeat(2000)]) {
      expect(readOAuthState(value, SECRET, expectGoogle)).toBeNull();
    }
  });
});

type FakeResponse = {
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
};

function fakeResponse(): FakeResponse {
  return { cookie: vi.fn(), clearCookie: vi.fn() };
}

function store(callbackUrl = CALLBACK, now = () => NOW) {
  return new OAuthStateStore({ provider: OAuthProvider.google, secret: SECRET, callbackUrl, now });
}

/** Runs `store` for a begin request and returns the state and the nonce cookie it set. */
function begin(subject: OAuthStateStore, query: Record<string, unknown> = {}) {
  const res = fakeResponse();
  let state: string | undefined;
  subject.store({ query, res } as OAuthStateRequest, (err, value) => {
    expect(err).toBeNull();
    state = value;
  });
  const [name, nonce, options] = res.cookie.mock.calls[0] as [
    string,
    string,
    Record<string, unknown>,
  ];
  return { state: state!, name, nonce, options };
}

function verify(subject: OAuthStateStore, state: string, cookie: string | undefined) {
  const res = fakeResponse();
  const callback = vi.fn();
  subject.verify({ headers: { cookie }, res } as OAuthStateRequest, state, callback);
  return { callback, res };
}

describe('OAuthStateStore', () => {
  it('matches the arities passport-oauth2 dispatches on', () => {
    // store(req, cb) and verify(req, state, cb): no meta argument expected.
    expect(OAuthStateStore.prototype.store.length).toBe(2);
    expect(OAuthStateStore.prototype.verify.length).toBe(3);
  });

  it('carries a valid catalog model from sign-in to callback', () => {
    const subject = store();
    const started = begin(subject, { catalogModel: 'city' });

    const { callback, res } = verify(
      subject,
      started.state,
      `other=1; ${OAUTH_STATE_COOKIE}=${started.nonce}`,
    );

    expect(callback).toHaveBeenCalledWith(null, true, { catalogModel: 'city' });
    // Single use.
    expect(res.clearCookie).toHaveBeenCalledWith(
      OAUTH_STATE_COOKIE,
      expect.objectContaining({ path: '/api/auth/oauth/google/callback' }),
    );
  });

  it('carries no model when sign-in began without one', () => {
    const subject = store();
    const started = begin(subject);

    const { callback } = verify(subject, started.state, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

    expect(callback).toHaveBeenCalledWith(null, true, {});
  });

  it('drops a model that is not a catalog slug instead of refusing the sign-in', () => {
    const subject = store();

    for (const catalogModel of ['City', '../admin', 'a b', ['city', 'nexon'], { $ne: 1 }]) {
      const started = begin(subject, { catalogModel });
      const { callback } = verify(subject, started.state, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

      expect(callback).toHaveBeenCalledWith(null, true, {});
    }
  });

  it('carries a same-origin return path from sign-in to callback', () => {
    const subject = store();
    const started = begin(subject, { next: '/vehicle-invites/tok-1' });

    const { callback } = verify(subject, started.state, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

    expect(callback).toHaveBeenCalledWith(null, true, { next: '/vehicle-invites/tok-1' });
  });

  it('drops a return path that would leave the site instead of refusing the sign-in', () => {
    const subject = store();

    for (const next of [
      'https://evil.example.test',
      '//evil.example.test',
      '/\\evil.example.test',
      'javascript:alert(1)',
      ['/dashboard'],
    ]) {
      const started = begin(subject, { catalogModel: 'city', next });
      const { callback } = verify(subject, started.state, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

      expect(callback).toHaveBeenCalledWith(null, true, { catalogModel: 'city' });
    }
  });

  it('sets the nonce as an HttpOnly, SameSite=Lax cookie on the callback path only', () => {
    const started = begin(store(), { catalogModel: 'city' });

    expect(started.name).toBe(OAUTH_STATE_COOKIE);
    expect(started.nonce.length).toBeGreaterThanOrEqual(32);
    expect(started.options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/api/auth/oauth/google/callback',
      maxAge: OAUTH_STATE_TTL_MS,
    });
    // The nonce is in the signed state, not something the state can be rebuilt from.
    expect(decodeBody(started.state)).toMatchObject({ n: started.nonce, m: 'city' });
  });

  it('leaves the cookie insecure only for a plain-http callback, as in local development', () => {
    const started = begin(store('http://localhost:3000/api/auth/oauth/google/callback'));

    expect(started.options).toMatchObject({ secure: false });
  });

  it('gives every sign-in its own nonce', () => {
    const subject = store();

    expect(begin(subject).nonce).not.toBe(begin(subject).nonce);
  });

  it('refuses a callback from a browser that never began this sign-in (login CSRF)', () => {
    const subject = store();
    const attackers = begin(subject, { catalogModel: 'city' });
    const victims = begin(subject);

    // No cookie at all.
    expect(verify(subject, attackers.state, undefined).callback).toHaveBeenCalledWith(null, false, {
      message: OAUTH_STATE_INVALID,
    });
    // The victim's own cookie, from another sign-in.
    expect(
      verify(subject, attackers.state, `${OAUTH_STATE_COOKIE}=${victims.nonce}`).callback,
    ).toHaveBeenCalledWith(null, false, { message: OAUTH_STATE_INVALID });
  });

  it('refuses a tampered model even with the right cookie', () => {
    const subject = store();
    const started = begin(subject, { catalogModel: 'city' });
    const tampered = withBody(started.state, { ...decodeBody(started.state), m: 'nexon' });

    const { callback, res } = verify(subject, tampered, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

    expect(callback).toHaveBeenCalledWith(null, false, { message: OAUTH_STATE_INVALID });
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('refuses a callback once the state has expired', () => {
    let now = NOW;
    const subject = store(CALLBACK, () => now);
    const started = begin(subject, { catalogModel: 'city' });
    now += OAUTH_STATE_TTL_MS + 1;

    const { callback } = verify(subject, started.state, `${OAUTH_STATE_COOKIE}=${started.nonce}`);

    expect(callback).toHaveBeenCalledWith(null, false, { message: OAUTH_STATE_INVALID });
  });

  it('refuses a callback with no state', () => {
    const { callback } = verify(store(), undefined as unknown as string, `${OAUTH_STATE_COOKIE}=x`);

    expect(callback).toHaveBeenCalledWith(null, false, { message: OAUTH_STATE_INVALID });
  });

  it('fails to begin rather than start a sign-in it could never finish', () => {
    const callback = vi.fn();

    store().store({ query: {} }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error));
  });
});

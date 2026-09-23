import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { OAuthProvider } from '@prisma/client';
import type { StrategyOptions } from 'passport-google-oauth20';
import { CATALOG_SLUG_MAX_LENGTH, CATALOG_SLUG_PATTERN } from '@vehicle-vault/shared';

/**
 * The OAuth `state` parameter: what ties a provider's callback to the sign-in
 * this browser started, and what carries a catalog model slug across the
 * provider redirect so an OAuth sign-up from "Track this vehicle" is
 * attributed like an email one.
 *
 * `state` is `<payload>.<signature>`: base64url JSON holding the provider, a
 * random nonce, the expiry and, optionally, the model slug, signed with an
 * HMAC key derived from `JWT_SECRET`. The nonce is also set as an HttpOnly
 * cookie scoped to the provider's callback path. A callback is accepted only
 * when the signature holds, the provider matches, the state has not expired
 * and the cookie holds the same nonce. So:
 *
 * - the slug cannot be changed without breaking the signature, and is checked
 *   against the catalog slug pattern on the way in and on the way out;
 * - a callback URL minted by someone else (login CSRF) fails, because the
 *   victim's browser does not hold that state's nonce.
 *
 * No server-side session is needed, which matches the stateless API.
 */

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_STATE_COOKIE = 'vv_oauth_state';
/** The failure `message` passport receives when a callback's state is refused. */
export const OAUTH_STATE_INVALID = 'oauth_state_invalid';

const STATE_VERSION = 1;
const MAX_STATE_LENGTH = 1024;

export type OAuthStatePayload = {
  provider: OAuthProvider;
  nonce: string;
  expiresAt: number;
  catalogModel?: string;
};

/** What a verified state hands the callback, as passport's `authInfo.state`. */
export type OAuthStateInfo = { catalogModel?: string };

/** A catalog model slug, validated the way `RegisterDto.catalogModel` is, or undefined. */
export function toCatalogModel(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.length <= CATALOG_SLUG_MAX_LENGTH &&
    CATALOG_SLUG_PATTERN.test(value)
    ? value
    : undefined;
}

function signingKey(secret: string) {
  // A key of its own, so a state signature is never a valid signature for
  // anything else signed with the JWT secret.
  return createHmac('sha256', secret).update('vehicle-vault:oauth-state').digest();
}

function sign(body: string, secret: string) {
  return createHmac('sha256', signingKey(secret)).update(body).digest('base64url');
}

function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createOAuthNonce() {
  return randomBytes(24).toString('base64url');
}

export function signOAuthState(payload: OAuthStatePayload, secret: string): string {
  const catalogModel = toCatalogModel(payload.catalogModel);
  const body = Buffer.from(
    JSON.stringify({
      v: STATE_VERSION,
      p: payload.provider,
      n: payload.nonce,
      e: payload.expiresAt,
      ...(catalogModel ? { m: catalogModel } : {}),
    }),
  ).toString('base64url');

  return `${body}.${sign(body, secret)}`;
}

/**
 * The payload of a state this server signed for `provider` and that has not
 * expired, or null. Says nothing about the cookie: see `OAuthStateStore`.
 */
export function readOAuthState(
  state: unknown,
  secret: string,
  expected: { provider: OAuthProvider; now: number },
): OAuthStatePayload | null {
  if (typeof state !== 'string' || state.length > MAX_STATE_LENGTH) {
    return null;
  }

  const [body, signature, ...rest] = state.split('.');

  if (!body || !signature || rest.length > 0 || !sameString(signature, sign(body, secret))) {
    return null;
  }

  let parsed: Record<string, unknown>;

  try {
    const decoded: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));

    if (!decoded || typeof decoded !== 'object') {
      return null;
    }

    parsed = decoded as Record<string, unknown>;
  } catch {
    return null;
  }

  const { v, p, n, e, m } = parsed;
  const catalogModel = toCatalogModel(m);

  if (
    v !== STATE_VERSION ||
    p !== expected.provider ||
    typeof n !== 'string' ||
    n.length === 0 ||
    typeof e !== 'number' ||
    expected.now > e ||
    (m !== undefined && catalogModel === undefined)
  ) {
    return null;
  }

  return {
    provider: expected.provider,
    nonce: n,
    expiresAt: e,
    ...(catalogModel ? { catalogModel } : {}),
  };
}

type CookieOptions = {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge?: number;
};

type StateResponse = {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: CookieOptions): unknown;
};

export type OAuthStateRequest = {
  query?: unknown;
  headers?: { cookie?: string | string[] };
  res?: StateResponse;
};

type StoreCallback = (err: Error | null, state?: string) => void;
type VerifyCallback = (
  err: Error | null,
  ok: boolean,
  info?: OAuthStateInfo | { message: string },
) => void;

function readCookie(header: string | string[] | undefined, name: string): string | null {
  const raw = Array.isArray(header) ? header.join(';') : header;

  for (const part of raw?.split(';') ?? []) {
    const separator = part.indexOf('=');

    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }

  return null;
}

function queryValue(query: unknown, key: string): unknown {
  return query && typeof query === 'object' ? (query as Record<string, unknown>)[key] : undefined;
}

/**
 * The passport-oauth2 state store for one provider (passed as the strategy's
 * `store`). `store` runs when sign-in begins and reads the optional
 * `catalogModel` query parameter; an invalid one is dropped rather than
 * refused, because attribution must never stop someone signing in. `verify`
 * runs on the callback before the code is exchanged.
 */
export class OAuthStateStore {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly options: {
      provider: OAuthProvider;
      secret: string;
      callbackUrl: string;
      now?: () => number;
    },
  ) {
    let url: URL | null = null;

    try {
      url = new URL(options.callbackUrl);
    } catch {
      url = null;
    }

    this.cookieOptions = {
      httpOnly: true,
      // Sent on the provider's top-level redirect back, not on cross-site subrequests.
      sameSite: 'lax',
      secure: url?.protocol === 'https:',
      // Only the callback ever reads it.
      path: url?.pathname ?? '/',
    };
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  store(req: OAuthStateRequest, callback: StoreCallback): void {
    if (!req.res) {
      callback(new Error('Cannot begin OAuth sign-in without a response to set its state cookie.'));
      return;
    }

    const nonce = createOAuthNonce();
    const state = signOAuthState(
      {
        provider: this.options.provider,
        nonce,
        expiresAt: this.now() + OAUTH_STATE_TTL_MS,
        catalogModel: toCatalogModel(queryValue(req.query, 'catalogModel')),
      },
      this.options.secret,
    );

    req.res.cookie(OAUTH_STATE_COOKIE, nonce, {
      ...this.cookieOptions,
      maxAge: OAUTH_STATE_TTL_MS,
    });
    callback(null, state);
  }

  verify(req: OAuthStateRequest, providedState: string, callback: VerifyCallback): void {
    const payload = readOAuthState(providedState, this.options.secret, {
      provider: this.options.provider,
      now: this.now(),
    });
    const nonce = readCookie(req.headers?.cookie, OAUTH_STATE_COOKIE);

    // Single use, whatever the outcome.
    req.res?.clearCookie(OAUTH_STATE_COOKIE, this.cookieOptions);

    if (!payload || !nonce || !sameString(nonce, payload.nonce)) {
      callback(null, false, { message: OAUTH_STATE_INVALID });
      return;
    }

    callback(null, true, payload.catalogModel ? { catalogModel: payload.catalogModel } : {});
  }
}

/** passport-oauth2's state store type, which both strategies' options share. */
type StateStore = NonNullable<StrategyOptions['store']>;

/**
 * The store as the strategies take it. passport-oauth2 picks the call shape by
 * arity (`store(req, cb)`, `verify(req, state, cb)` here); its typings list
 * every shape as overloads, which one class cannot satisfy.
 */
export function oauthStateStore(
  provider: OAuthProvider,
  secret: string,
  callbackUrl: string,
): StateStore {
  return new OAuthStateStore({ provider, secret, callbackUrl }) as unknown as StateStore;
}

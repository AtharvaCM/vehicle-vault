import type { ExecutionContext } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  OAuthCallbackGuard,
  toOAuthFailure,
  type OAuthCallbackRequest,
} from './oauth-callback.guard';
import { OAUTH_STATE_INVALID } from './oauth-state';

describe('toOAuthFailure', () => {
  it('reads a provider access_denied as a cancelled sign-in', () => {
    expect(toOAuthFailure({ query: { error: 'access_denied' } }, { message: 'User denied' })).toBe(
      'oauth_cancelled',
    );
  });

  it('reads a refused state as such', () => {
    expect(toOAuthFailure({ query: { code: 'x' } }, { message: OAUTH_STATE_INVALID })).toBe(
      'oauth_state_invalid',
    );
  });

  it('reads anything else as a failed sign-in', () => {
    expect(toOAuthFailure({ query: { error: 'server_error' } }, undefined)).toBe('oauth_failed');
    expect(toOAuthFailure({}, 'unexpected')).toBe('oauth_failed');
  });
});

describe('OAuthCallbackGuard', () => {
  function handle(err: unknown, user: unknown, info: unknown, request: OAuthCallbackRequest) {
    const Guard = OAuthCallbackGuard(OAuthProvider.google);
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return new Guard().handleRequest(err, user, info, context);
  }

  it('passes a signed-in profile through', () => {
    const request: OAuthCallbackRequest = {};

    expect(handle(null, { id: 'p' }, {}, request)).toEqual({ id: 'p' });
    expect(request.oauthFailure).toBeUndefined();
  });

  it('records why instead of throwing when there is no user', () => {
    const request: OAuthCallbackRequest = { query: { error: 'access_denied' } };

    expect(handle(null, false, undefined, request)).toBeUndefined();
    expect(request.oauthFailure).toBe('oauth_cancelled');
  });

  it('records a provider error instead of throwing', () => {
    const request: OAuthCallbackRequest = { query: { code: 'x' } };

    expect(() =>
      handle(new Error('Failed to obtain access token'), null, undefined, request),
    ).not.toThrow();
    expect(request.oauthFailure).toBe('oauth_failed');
  });
});

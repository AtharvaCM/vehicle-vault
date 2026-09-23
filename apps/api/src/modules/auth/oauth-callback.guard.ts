import { Logger, mixin, type ExecutionContext, type Type } from '@nestjs/common';
import { AuthGuard, type IAuthGuard } from '@nestjs/passport';
import type { OAuthProvider } from '@prisma/client';

import { OAUTH_STATE_INVALID } from './oauth-state';

/** Error codes the web's OAuth callback page receives in its fragment. */
export const OAUTH_FAILURE = {
  cancelled: 'oauth_cancelled',
  stateInvalid: OAUTH_STATE_INVALID,
  failed: 'oauth_failed',
} as const;

export type OAuthFailure = (typeof OAUTH_FAILURE)[keyof typeof OAUTH_FAILURE];

export type OAuthCallbackRequest = {
  query?: unknown;
  user?: unknown;
  /** Set by `@nestjs/passport`; a verified state's `OAuthStateInfo` is under `state`. */
  authInfo?: unknown;
  oauthFailure?: OAuthFailure;
};

function queryError(query: unknown) {
  return query && typeof query === 'object' ? (query as Record<string, unknown>).error : undefined;
}

function failureMessage(info: unknown) {
  return info && typeof info === 'object' ? (info as { message?: unknown }).message : undefined;
}

/**
 * Why a provider callback produced no user, as one of `OAUTH_FAILURE`: the
 * visitor cancelled at the provider, the state was refused, or anything else.
 */
export function toOAuthFailure(request: OAuthCallbackRequest, info: unknown): OAuthFailure {
  if (queryError(request.query) === 'access_denied') {
    return OAUTH_FAILURE.cancelled;
  }

  if (failureMessage(info) === OAUTH_STATE_INVALID) {
    return OAUTH_FAILURE.stateInvalid;
  }

  return OAUTH_FAILURE.failed;
}

/**
 * `AuthGuard(provider)` for a callback route, except that a failed or
 * cancelled sign-in does not throw. The stock guard answers with a JSON 401 on
 * the API's own origin, a dead end; this one records why on the request and
 * lets the controller send the visitor back to the web app, where they can try
 * again (with a catalog intent still waiting, if they had one).
 */
export function OAuthCallbackGuard(provider: OAuthProvider): Type<IAuthGuard> {
  const logger = new Logger(`OAuthCallbackGuard:${provider}`);

  class CallbackGuard extends AuthGuard(provider) {
    override handleRequest<TUser>(
      err: unknown,
      user: TUser,
      info: unknown,
      context: ExecutionContext,
    ): TUser {
      if (!err && user) {
        return user;
      }

      const request = context.switchToHttp().getRequest<OAuthCallbackRequest>();
      request.oauthFailure = toOAuthFailure(request, info);

      if (err) {
        logger.warn(`OAuth callback failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      return undefined as TUser;
    }
  }

  return mixin(CallbackGuard);
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, type Profile } from 'passport-github2';

import { AppConfigService } from '../../../config/app-config.service';
import { oauthStateStore } from '../oauth-state';
import type { OAuthProfile } from '../oauth.service';

type GithubEmail = { value: string; verified?: boolean; primary?: boolean };

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(appConfigService: AppConfigService) {
    const callbackURL =
      appConfigService.oauthGithubCallbackUrl ??
      'http://localhost:3000/api/auth/oauth/github/callback';
    super({
      clientID: appConfigService.oauthGithubClientId ?? 'unset',
      clientSecret: appConfigService.oauthGithubClientSecret ?? 'unset',
      callbackURL,
      // Signed, cookie-bound `state`; carries a catalog model slug. See oauth-state.ts.
      store: oauthStateStore(OAuthProvider.github, appConfigService.jwtSecret, callbackURL),
      scope: ['user:email'],
    });
  }

  // Returns the profile rather than calling passport's `done`: PassportStrategy
  // calls `done` with whatever this returns, so calling it here as well ran it
  // twice, a success then a failure, and the failure overwrote `authInfo`,
  // where the verified OAuth state (and its catalog model) arrives.
  validate(_accessToken: string, _refreshToken: string, profile: Profile): OAuthProfile {
    const emails = (profile.emails ?? []) as GithubEmail[];
    const primary =
      emails.find((entry) => entry.primary && entry.verified !== false) ??
      emails.find((entry) => entry.verified !== false) ??
      emails[0] ??
      null;

    const normalised: OAuthProfile = {
      provider: OAuthProvider.github,
      providerAccountId: String(profile.id),
      email: primary?.value ?? null,
      emailVerified: Boolean(primary && primary.verified !== false),
      name:
        profile.displayName || profile.username || primary?.value?.split('@')[0] || 'GitHub user',
    };
    return normalised;
  }
}

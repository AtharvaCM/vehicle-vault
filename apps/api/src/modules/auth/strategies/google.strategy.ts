import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, type Profile } from 'passport-google-oauth20';

import { AppConfigService } from '../../../config/app-config.service';
import { oauthStateStore } from '../oauth-state';
import type { OAuthProfile } from '../oauth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(appConfigService: AppConfigService) {
    const callbackURL =
      appConfigService.oauthGoogleCallbackUrl ??
      'http://localhost:3000/api/auth/oauth/google/callback';
    super({
      clientID: appConfigService.oauthGoogleClientId ?? 'unset',
      clientSecret: appConfigService.oauthGoogleClientSecret ?? 'unset',
      callbackURL,
      // Signed, cookie-bound `state`; carries a catalog model slug. See oauth-state.ts.
      store: oauthStateStore(OAuthProvider.google, appConfigService.jwtSecret, callbackURL),
      scope: ['email', 'profile'],
    });
  }

  // Returns the profile rather than calling passport's `done`: PassportStrategy
  // calls `done` with whatever this returns, so calling it here as well ran it
  // twice, a success then a failure, and the failure overwrote `authInfo`,
  // where the verified OAuth state (and its catalog model) arrives.
  validate(_accessToken: string, _refreshToken: string, profile: Profile): OAuthProfile {
    const primaryEmail = profile.emails?.[0];
    const normalised: OAuthProfile = {
      provider: OAuthProvider.google,
      providerAccountId: profile.id,
      email: primaryEmail?.value ?? null,
      // Google emails are verified by definition; verified flag isn't always
      // present on the OIDC userinfo response so we default to true.
      emailVerified: true,
      name: profile.displayName || primaryEmail?.value?.split('@')[0] || 'Google user',
    };
    return normalised;
  }
}

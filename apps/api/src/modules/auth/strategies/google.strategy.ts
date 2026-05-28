import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

import { AppConfigService } from '../../../config/app-config.service';
import type { OAuthProfile } from '../oauth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(appConfigService: AppConfigService) {
    super({
      clientID: appConfigService.oauthGoogleClientId ?? 'unset',
      clientSecret: appConfigService.oauthGoogleClientSecret ?? 'unset',
      callbackURL: appConfigService.oauthGoogleCallbackUrl ?? 'http://localhost:3000/api/auth/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
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
    done(null, normalised);
  }
}

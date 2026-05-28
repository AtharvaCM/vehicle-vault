import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OAuthProvider } from '@prisma/client';
import { Strategy, type Profile } from 'passport-github2';

import { AppConfigService } from '../../../config/app-config.service';
import type { OAuthProfile } from '../oauth.service';

type GithubEmail = { value: string; verified?: boolean; primary?: boolean };

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(appConfigService: AppConfigService) {
    super({
      clientID: appConfigService.oauthGithubClientId ?? 'unset',
      clientSecret: appConfigService.oauthGithubClientSecret ?? 'unset',
      callbackURL: appConfigService.oauthGithubCallbackUrl ?? 'http://localhost:3000/api/auth/oauth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: OAuthProfile) => void,
  ): Promise<void> {
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
        profile.displayName ||
        profile.username ||
        primary?.value?.split('@')[0] ||
        'GitHub user',
    };
    done(null, normalised);
  }
}

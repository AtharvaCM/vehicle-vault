import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import {
  AuthResponseSchema,
  AuthUserSchema,
  UserSchema,
  type AuthResponse,
  type AuthUser,
  type User,
} from '@vehicle-vault/shared';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenService } from './token.service';
import type { JwtPayload } from './auth.types';

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  name: string;
  emailVerified: boolean;
};

/**
 * Resolves an OAuth provider profile to a Vehicle Vault user, then issues
 * the same access/refresh token pair the password login flow returns.
 *
 * Account linking is automatic when the provider returns a verified
 * email matching an existing user. Both Google and GitHub return verified
 * primary emails, so cross-account hijacking via spoofed email is not a
 * concern. New users get an account with `passwordHash = null` and
 * `emailVerified = true`.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly jwtService: JwtService,
  ) {}

  async loginOrLink(profile: OAuthProfile): Promise<AuthResponse> {
    if (!profile.providerAccountId) {
      throw new UnauthorizedException('OAuth provider did not return an account id.');
    }

    let user = await this.findUserByLinkedAccount(profile);
    if (!user && profile.email && profile.emailVerified) {
      user = await this.linkExistingUserByEmail(profile);
    }
    if (!user) {
      user = await this.createUserAndLink(profile);
    }

    return this.buildAuthResponse(this.toUser(user));
  }

  private async findUserByLinkedAccount(profile: OAuthProfile) {
    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });
    return account?.user ?? null;
  }

  private async linkExistingUserByEmail(profile: OAuthProfile) {
    if (!profile.email) return null;
    const existing = await this.prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });
    if (!existing) return null;

    await this.prisma.oAuthAccount.create({
      data: {
        userId: existing.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    });
    if (!existing.emailVerified) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: true },
      });
    }
    return existing;
  }

  private async createUserAndLink(profile: OAuthProfile) {
    const email = profile.email?.toLowerCase() ?? `${profile.provider}-${profile.providerAccountId}@oauth.local`;
    return this.prisma.user.create({
      data: {
        name: profile.name || 'Vehicle Vault User',
        email,
        passwordHash: null,
        emailVerified: profile.emailVerified || Boolean(profile.email),
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      },
    });
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const authUser = this.toAuthUser(user);
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      name: authUser.name,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.tokenService.rotateRefreshToken(authUser);

    return AuthResponseSchema.parse({
      user: authUser,
      accessToken,
      refreshToken,
    });
  }

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    allowedCatalogSources: string[];
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return UserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      allowedCatalogSources: user.allowedCatalogSources,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  }

  private toAuthUser(user: User): AuthUser {
    return AuthUserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      allowedCatalogSources: user.allowedCatalogSources,
    });
  }
}

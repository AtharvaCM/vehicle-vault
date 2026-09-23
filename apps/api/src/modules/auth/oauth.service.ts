import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditResourceType, OAuthProvider } from '@prisma/client';
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
import { AuditService } from '../audit/audit.service';
import { ProductEventsService } from '../product-events/product-events.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import {
  getEmailVerificationDueAt,
  OAUTH_PLACEHOLDER_EMAIL_DOMAIN,
} from './email-verification-deadline';
import { TokenService } from './token.service';
import type { JwtPayload } from './auth.types';

/** Where an OAuth sign-in came from, for `account_created`. */
export type OAuthAttribution = {
  /** A validated catalog model slug from the signed OAuth state. */
  catalogModel?: string;
};

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
    private readonly auditService: AuditService,
    private readonly productEvents: ProductEventsService,
  ) {}

  async loginOrLink(
    profile: OAuthProfile,
    attribution: OAuthAttribution = {},
  ): Promise<AuthResponse> {
    if (!profile.providerAccountId) {
      throw new UnauthorizedException('OAuth provider did not return an account id.');
    }

    let user = await this.findUserByLinkedAccount(profile);
    let outcome: 'linked_existing' | 'linked_new' | 'login_only' = 'login_only';
    if (!user && profile.email && profile.emailVerified) {
      user = await this.linkExistingUserByEmail(profile);
      if (user) outcome = 'linked_existing';
    }
    if (!user) {
      user = await this.createUserAndLink(profile);
      outcome = 'linked_new';
    }

    if (outcome === 'linked_existing' || outcome === 'linked_new') {
      await this.auditService.track(this.prisma, {
        actorUserId: user.id,
        ownerUserId: user.id,
        action:
          outcome === 'linked_new'
            ? AUDIT_ACTIONS.auth.accountCreated
            : AUDIT_ACTIONS.auth.oauthLinked,
        resourceType: AuditResourceType.oauth_account,
        resourceId: null,
        after: { provider: profile.provider, email: user.email },
      });
    }

    // An OAuth address arrives already verified, so these accounts never emit
    // `email_verified`; the method here is what lets a funnel account for that.
    if (outcome === 'linked_new') {
      await this.productEvents.record(this.prisma, {
        name: 'account_created',
        userId: user.id,
        properties: {
          method: profile.provider,
          // Signed up from a public catalog page's "Track this vehicle", as a
          // password sign-up would be. Only a new account is attributed.
          ...(attribution.catalogModel
            ? { source: 'catalog', catalogModel: attribution.catalogModel }
            : {}),
        },
      });
    }

    await this.auditService.track(this.prisma, {
      actorUserId: user.id,
      ownerUserId: user.id,
      action: AUDIT_ACTIONS.auth.loginSucceeded,
      resourceType: AuditResourceType.user,
      resourceId: user.id,
      after: { provider: profile.provider, email: user.email },
    });

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
    const email =
      profile.email?.toLowerCase() ??
      `${profile.provider}-${profile.providerAccountId}@${OAUTH_PLACEHOLDER_EMAIL_DOMAIN}`;
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
      emailVerificationDueAt: getEmailVerificationDueAt(user),
    });
  }
}

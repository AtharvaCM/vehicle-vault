import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  AccountSecuritySchema,
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  PasswordChangeSchema,
  PasswordResetConfirmResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestResponseSchema,
  PasswordResetRequestSchema,
  RefreshTokenSchema,
  RegisterSchema,
  UserSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  type AccountSecurity,
  type AuthResponse,
  type AuthUser,
  type LoginInput,
  type PasswordResetConfirmInput,
  type PasswordResetConfirmResponse,
  type PasswordResetRequestInput,
  type PasswordResetRequestResponse,
  type RefreshTokenInput,
  type RegisterInput,
  type User,
  type UserRole,
  type VerifyEmailInput,
  type ResendVerificationInput,
  type ResendVerificationResponse,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { RateLimitedException } from '../../common/rate-limit/rate-limited.exception';
import { AppConfigService } from '../../config/app-config.service';
import { AuditService } from '../audit/audit.service';
import { ProductEventsService } from '../product-events/product-events.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditResourceType } from '@prisma/client';
import { getEmailVerificationDueAt } from './email-verification-deadline';
import { TokenService } from './token.service';
import type { LoginDto } from './dto/login.dto';
import type { PasswordChangeDto } from './dto/password-change.dto';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { JwtPayload } from './auth.types';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  passwordResetTokenExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  refreshTokenHash?: string | null;
  role: UserRole;
  allowedCatalogSources: string[];
  createdAt: Date;
  updatedAt: Date;
};

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const PASSWORD_RESET_UNAVAILABLE_MESSAGE = 'Password reset is unavailable right now.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
    private readonly mailService: MailService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly rateLimit: RateLimitService,
    private readonly productEvents: ProductEventsService,
  ) {}

  async register(payload: RegisterDto) {
    const input = this.validateRegisterInput(payload);
    const passwordHash = await hash(input.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash,
          emailVerified: false,
        },
      });

      await this.auditService.track(this.prisma, {
        actorUserId: user.id,
        ownerUserId: user.id,
        action: AUDIT_ACTIONS.auth.accountCreated,
        resourceType: AuditResourceType.user,
        resourceId: user.id,
        after: { email: user.email, name: user.name },
      });
      await this.productEvents.record(this.prisma, {
        name: 'account_created',
        userId: user.id,
        properties: {
          method: 'password',
          // Signed up from a public catalog page's "Track this vehicle".
          ...(input.catalogModel ? { source: 'catalog', catalogModel: input.catalogModel } : {}),
        },
      });

      const { url } = await this.tokenService.issueEmailVerification(user.id);

      // Best-effort: the user row is already committed, so a mail failure here
      // would strand the address behind the P2002 conflict below with no way to
      // re-register. The account stays unverified and the verify screen's resend
      // action can issue a fresh token once delivery recovers.
      try {
        await this.mailService.sendVerificationEmail({
          email: user.email,
          name: user.name,
          verificationUrl: url,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${user.email} during registration`,
          error instanceof Error ? error.stack : undefined,
        );
      }

      return this.buildAuthResponse(this.toUser(user));
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  /**
   * `clientIp` is what the login rate limit counts by. It is checked before the
   * password — the bcrypt compare is the expensive step a guessing loop wants —
   * but after the email is known, so a refused attempt is still recorded
   * against the account it was aimed at, where its owner can see it.
   */
  async login(payload: LoginDto, clientIp = 'unknown') {
    const input = this.validateLoginInput(payload);
    const email = input.email.trim().toLowerCase();

    const limit = this.rateLimit.hit('login', clientIp);
    if (limit.limited) {
      const target = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      await this.trackLoginFailure(target?.id ?? null, email, 'rate_limited');
      throw new RateLimitedException(limit.retryAfterSeconds);
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !user.passwordHash) {
      await this.trackLoginFailure(user?.id ?? null, email, 'no_credential');
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.trackLoginFailure(user.id, user.email, 'bad_password');
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.auditService.track(this.prisma, {
      actorUserId: user.id,
      ownerUserId: user.id,
      action: AUDIT_ACTIONS.auth.loginSucceeded,
      resourceType: AuditResourceType.user,
      resourceId: user.id,
      after: { email: user.email },
    });

    return this.buildAuthResponse(this.toUser(user));
  }

  /**
   * One shape for every refused login. Attributed to the targeted account when
   * one exists — including as actor, which is why the dormancy check in the
   * alert engine has to ignore this action.
   */
  private async trackLoginFailure(
    userId: string | null,
    email: string,
    reason: 'no_credential' | 'bad_password' | 'rate_limited',
  ) {
    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: AUDIT_ACTIONS.auth.loginFailed,
      resourceType: AuditResourceType.user,
      resourceId: userId,
      after: { email, reason },
    });
  }

  async refresh(payload: RefreshTokenDto) {
    const input = this.validateRefreshTokenInput(payload);
    const user = await this.tokenService.verifyRefreshToken(input.refreshToken);
    return this.buildAuthResponse(this.toUser(user));
  }

  async requestPasswordReset(
    payload: PasswordResetRequestDto,
  ): Promise<PasswordResetRequestResponse> {
    const input = this.validatePasswordResetRequestInput(payload);

    if (this.appConfigService.isProduction && !this.mailService.isConfigured) {
      throw new ServiceUnavailableException(PASSWORD_RESET_UNAVAILABLE_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email.trim().toLowerCase(),
      },
    });

    if (!user) {
      return PasswordResetRequestResponseSchema.parse({
        accepted: true,
      });
    }

    const issued = await this.tokenService.issuePasswordReset(user.id);

    if (this.mailService.isConfigured) {
      try {
        await this.mailService.sendPasswordResetEmail({
          email: user.email,
          expiresAt: issued.expiresAt,
          name: user.name,
          resetUrl: issued.url,
        });
      } catch (error) {
        if (this.appConfigService.isProduction) {
          throw error;
        }
      }
    }

    return PasswordResetRequestResponseSchema.parse({
      accepted: true,
      ...(this.appConfigService.isProduction
        ? {}
        : {
            expiresAt: issued.expiresAt.toISOString(),
            previewToken: issued.token,
          }),
    });
  }

  async resetPassword(payload: PasswordResetConfirmDto): Promise<PasswordResetConfirmResponse> {
    const input = this.validatePasswordResetConfirmInput(payload);
    const user = await this.tokenService.consumePasswordReset(input.token);

    const passwordHash = await hash(input.password, 12);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        refreshTokenHash: null,
      },
    });

    return PasswordResetConfirmResponseSchema.parse({
      reset: true,
    });
  }

  async verifyEmail(payload: VerifyEmailDto) {
    const input = this.validateVerifyEmailInput(payload);
    const user = await this.tokenService.consumeEmailVerification(input.token);
    // A spent or unknown token throws above, so this counts each verification once.
    await this.productEvents.record(this.prisma, { name: 'email_verified', userId: user.id });
    return { verified: true };
  }

  async resendVerification(payload: ResendVerificationDto): Promise<ResendVerificationResponse> {
    const input = this.validateResendVerificationInput(payload);
    // Without a mail transport nothing can go out: say so, and do not issue a
    // token nobody will receive. Answered the same for every address.
    const delivered = this.mailService.isConfigured;

    if (!delivered) {
      return { accepted: true, delivered };
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email.trim().toLowerCase(),
      },
    });

    if (!user || user.emailVerified) {
      return { accepted: true, delivered };
    }

    const { url } = await this.tokenService.issueEmailVerification(user.id);

    await this.mailService.sendVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl: url,
    });

    return { accepted: true, delivered };
  }

  async logout(payload: RefreshTokenDto) {
    const input = this.validateRefreshTokenInput(payload);
    const user = await this.tokenService.tryVerifyRefreshToken(input.refreshToken);
    if (!user) return;
    await this.tokenService.revokeRefreshToken(user.id);
    await this.auditService.track(this.prisma, {
      actorUserId: user.id,
      ownerUserId: user.id,
      action: AUDIT_ACTIONS.auth.loggedOut,
      resourceType: AuditResourceType.user,
      resourceId: user.id,
    });
  }

  /**
   * Changes the password of a signed-in account. With a password on file the
   * current one must match; an account that only signs in with Google or
   * GitHub sets its first one. The refresh token is rotated and returned, so
   * this session carries on while every other one is signed out (there is one
   * refresh token per account).
   */
  async changePassword(userId: string, payload: PasswordChangeDto): Promise<AuthResponse> {
    const input = PasswordChangeSchema.parse(payload);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Invalid authentication token.');

    if (user.passwordHash) {
      // 400, not 401: a wrong current password must not read as a dead session.
      if (!input.currentPassword || !(await compare(input.currentPassword, user.passwordHash))) {
        throw new BadRequestException('Your current password is not right.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(input.newPassword, 12) },
    });
    await this.auditService.track(this.prisma, {
      actorUserId: user.id,
      ownerUserId: user.id,
      action: AUDIT_ACTIONS.auth.passwordChanged,
      resourceType: AuditResourceType.user,
      resourceId: user.id,
      after: { firstPassword: !user.passwordHash },
    });

    return this.buildAuthResponse(this.toUser(updated));
  }

  /** How the account can sign in: a password, and which providers are linked. */
  async getSecurity(userId: string): Promise<AccountSecurity> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, oauthAccounts: { select: { provider: true } } },
    });
    if (!user) throw new UnauthorizedException('Invalid authentication token.');

    return AccountSecuritySchema.parse({
      hasPassword: Boolean(user.passwordHash),
      oauthProviders: [...new Set(user.oauthAccounts.map((account) => account.provider))].sort(),
    });
  }

  async getMe(userId: string) {
    const user = await this.getUserById(userId);

    return this.toAuthUser(user);
  }

  async getAuthUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    return user ? this.toAuthUser(this.toUser(user)) : null;
  }

  private async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return this.toUser(user);
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const authUser = this.toAuthUser(user);
    const accessToken = await this.signAccessToken(authUser);
    const refreshToken = await this.tokenService.rotateRefreshToken(authUser);

    return AuthResponseSchema.parse({
      user: authUser,
      accessToken,
      refreshToken,
    });
  }

  private async signAccessToken(authUser: AuthUser) {
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      name: authUser.name,
    };

    return this.jwtService.signAsync(payload);
  }

  private validateRegisterInput(payload: RegisterDto): RegisterInput {
    return RegisterSchema.parse({
      ...payload,
      name: payload.name?.trim(),
      email: payload.email?.trim().toLowerCase(),
    });
  }

  private validateLoginInput(payload: LoginDto): LoginInput {
    return LoginSchema.parse({
      ...payload,
      email: payload.email?.trim().toLowerCase(),
    });
  }

  private validatePasswordResetRequestInput(
    payload: PasswordResetRequestDto,
  ): PasswordResetRequestInput {
    return PasswordResetRequestSchema.parse({
      ...payload,
      email: payload.email?.trim().toLowerCase(),
    });
  }

  private validatePasswordResetConfirmInput(
    payload: PasswordResetConfirmDto,
  ): PasswordResetConfirmInput {
    return PasswordResetConfirmSchema.parse(payload);
  }

  private validateRefreshTokenInput(payload: RefreshTokenDto): RefreshTokenInput {
    return RefreshTokenSchema.parse(payload);
  }

  private validateVerifyEmailInput(payload: VerifyEmailDto): VerifyEmailInput {
    return VerifyEmailSchema.parse(payload);
  }

  private validateResendVerificationInput(payload: ResendVerificationDto): ResendVerificationInput {
    return ResendVerificationSchema.parse(payload);
  }

  private toUser(user: UserRecord): User {
    return UserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
      role: user.role,
      emailVerified: user.emailVerified,
      allowedCatalogSources: user.allowedCatalogSources,
      emailVerificationDueAt: getEmailVerificationDueAt(user),
    });
  }
}

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  AccountSecuritySchema,
  AuthResponseSchema,
  AuthSessionListSchema,
  AuthUserSchema,
  LoginSchema,
  PasswordChangeSchema,
  ProfileUpdateSchema,
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
  type AuthSession,
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
import type { ProfileUpdateDto } from './dto/profile-update.dto';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { JwtPayload } from './auth.types';
import { describeUserAgent, NO_SESSION_CONTEXT, type SessionContext } from './session-context';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string | null;
  passwordResetTokenExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash?: string | null;
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

  async register(payload: RegisterDto, context: SessionContext = NO_SESSION_CONTEXT) {
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

      return this.buildAuthResponse(this.toUser(user), { context });
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
  async login(
    payload: LoginDto,
    clientIp = 'unknown',
    context: SessionContext = NO_SESSION_CONTEXT,
  ) {
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
      after: {
        email: user.email,
        device: describeUserAgent(context.userAgent),
        location: context.location,
      },
    });

    return this.buildAuthResponse(this.toUser(user), { context });
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

  async refresh(payload: RefreshTokenDto, context: SessionContext = NO_SESSION_CONTEXT) {
    const input = this.validateRefreshTokenInput(payload);
    const { user, sessionId } = await this.tokenService.verifyRefreshToken(input.refreshToken);
    return this.buildAuthResponse(this.toUser(user), { sessionId, context });
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
      },
    });
    // Whoever asked for the reset may not be the only one holding the account:
    // every session ends, and the new password starts the next one.
    await this.tokenService.revokeSessions(user.id);

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
    const verified = await this.tokenService.tryVerifyRefreshToken(input.refreshToken);
    if (!verified) return;
    const { user, sessionId } = verified;
    // This device only: the others stay signed in.
    await this.tokenService.revokeSession(user.id, sessionId);
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
   * GitHub sets its first one. Every other session is signed out; this one
   * (`sessionId`, from the access token) carries on with a rotated refresh
   * token, returned here. Without a session id (a token from before sessions)
   * a new session is started instead.
   */
  async changePassword(
    userId: string,
    payload: PasswordChangeDto,
    sessionId?: string | null,
    context: SessionContext = NO_SESSION_CONTEXT,
  ): Promise<AuthResponse> {
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
    await this.tokenService.revokeSessions(user.id, sessionId);

    return this.buildAuthResponse(
      this.toUser(updated),
      sessionId ? { sessionId, context } : { context },
    );
  }

  /** Settings → Security: where the account is signed in, this device marked. */
  async listSessions(userId: string, currentSessionId?: string | null): Promise<AuthSession[]> {
    const sessions = await this.tokenService.listSessions(userId);

    return AuthSessionListSchema.parse(
      sessions.map((session) => ({
        id: session.id,
        device: describeUserAgent(session.userAgent),
        location: session.location,
        createdAt: session.createdAt.toISOString(),
        lastActiveAt: session.lastActiveAt.toISOString(),
        current: session.id === currentSessionId,
      })),
    );
  }

  /**
   * Sign one session out; it fails its next refresh and lands on sign-in.
   * Any of the user's sessions, this one included (Sign out does that from
   * the device itself). 404 for a session that is not theirs or already gone.
   */
  async revokeSession(userId: string, sessionId: string, currentSessionId?: string | null) {
    const session = (await this.tokenService.listSessions(userId)).find(
      (candidate) => candidate.id === sessionId,
    );
    if (!session || !(await this.tokenService.revokeSession(userId, sessionId))) {
      throw new NotFoundException('That session has already been signed out.');
    }

    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: AUDIT_ACTIONS.auth.sessionRevoked,
      resourceType: AuditResourceType.user,
      resourceId: userId,
      after: {
        sessionId,
        device: describeUserAgent(session.userAgent),
        location: session.location,
        current: sessionId === currentSessionId,
      },
    });

    return { revoked: true };
  }

  /** "Sign out other devices": every session but the one asking. */
  async revokeOtherSessions(userId: string, currentSessionId?: string | null) {
    // A token from before sessions names none, so "the others" cannot be told
    // apart from this one. It is refreshed within the hour, and names one then.
    if (!currentSessionId) {
      throw new BadRequestException('Reload the page, then try again.');
    }

    const count = await this.tokenService.revokeSessions(userId, currentSessionId);
    if (count > 0) {
      await this.auditService.track(this.prisma, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.auth.otherSessionsRevoked,
        resourceType: AuditResourceType.user,
        resourceId: userId,
        after: { count },
      });
    }

    return { revoked: count };
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

  /** Settings → Account: a new name, recorded with the old one in the activity log. */
  async updateProfile(userId: string, payload: ProfileUpdateDto): Promise<AuthUser> {
    const input = ProfileUpdateSchema.parse(payload);
    const user = await this.getUserById(userId);
    if (input.name === user.name) return this.toAuthUser(user);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name },
    });
    await this.auditService.track(this.prisma, {
      actorUserId: userId,
      ownerUserId: userId,
      action: AUDIT_ACTIONS.auth.profileUpdated,
      resourceType: AuditResourceType.user,
      resourceId: userId,
      before: { name: user.name },
      after: { name: input.name },
    });

    return this.toAuthUser(this.toUser(updated));
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

  /**
   * Tokens for a sign-in: a new session, or with `sessionId` the same session
   * with its refresh token rotated. The access token names the session, which
   * is how "This device" and "Sign out other devices" know which one is asking.
   */
  private async buildAuthResponse(
    user: User,
    { sessionId, context }: { sessionId?: string; context: SessionContext },
  ): Promise<AuthResponse> {
    const authUser = this.toAuthUser(user);
    const session = sessionId
      ? await this.tokenService.rotateSession(authUser.id, sessionId, context)
      : await this.tokenService.startSession(authUser.id, context);
    const accessToken = await this.signAccessToken(authUser, session.sessionId);
    const refreshToken = session.refreshToken;

    return AuthResponseSchema.parse({
      user: authUser,
      accessToken,
      refreshToken,
    });
  }

  private async signAccessToken(authUser: AuthUser, sessionId: string) {
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      name: authUser.name,
      sid: sessionId,
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

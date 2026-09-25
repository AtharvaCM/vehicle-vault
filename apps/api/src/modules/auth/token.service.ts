import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RefreshTokenPayload } from './auth.types';
import { NO_SESSION_CONTEXT, type SessionContext } from './session-context';

export type IssuedToken = {
  token: string;
  url: string;
  expiresAt: Date;
};

export type ConsumedVerificationUser = {
  id: string;
  email: string;
  name: string;
};

export type ConsumedPasswordResetUser = {
  id: string;
  email: string;
  name: string;
};

export type IssuedSession = {
  sessionId: string;
  refreshToken: string;
};

export type VerifiedRefresh = {
  user: User;
  sessionId: string;
};

export const EMAIL_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const INVALID_VERIFICATION_TOKEN_MESSAGE = 'Invalid or expired verification token.';
const INVALID_PASSWORD_RESET_TOKEN_MESSAGE = 'Invalid or expired password reset token.';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token.';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfigService: AppConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async issueEmailVerification(userId: string): Promise<IssuedToken> {
    const token = this.generate();
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: this.hash(token),
        emailVerificationTokenExpiresAt: expiresAt,
      },
    });

    return {
      token,
      url: this.buildVerificationUrl(token),
      expiresAt,
    };
  }

  async issuePasswordReset(userId: string): Promise<IssuedToken> {
    const token = this.generate();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetTokenHash: this.hash(token),
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    return {
      token,
      url: this.buildPasswordResetUrl(token),
      expiresAt,
    };
  }

  async consumePasswordReset(token: string): Promise<ConsumedPasswordResetUser> {
    const candidateHash = this.hash(token);

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: candidateHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        passwordResetTokenExpiresAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
    }

    if (!user.passwordResetTokenExpiresAt || user.passwordResetTokenExpiresAt < new Date()) {
      throw new UnauthorizedException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return { id: user.id, email: user.email, name: user.name };
  }

  async consumeEmailVerification(token: string): Promise<ConsumedVerificationUser> {
    const candidateHash = this.hash(token);

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: candidateHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerificationTokenExpiresAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_VERIFICATION_TOKEN_MESSAGE);
    }

    if (
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(INVALID_VERIFICATION_TOKEN_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { id: user.id, email: user.email, name: user.name };
  }

  /**
   * Start a session for a sign-in (register, login, OAuth): a fresh refresh
   * JWT whose SHA-256 hash is stored on a new `AuthSession` row. Other
   * sessions are left alone, so a second device no longer signs out the first.
   */
  async startSession(userId: string, context: SessionContext): Promise<IssuedSession> {
    const refreshToken = await this.signRefreshToken(userId);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash: this.hash(refreshToken),
        userAgent: context.userAgent,
        location: context.location,
      },
      select: { id: true },
    });

    return { sessionId: session.id, refreshToken };
  }

  /**
   * Replace a session's refresh token with a fresh one, which is what every
   * refresh does: the old token stops working at once. Marks the session
   * active now, and records the device again when the request says what it
   * is. Throws when the session is gone (revoked meanwhile).
   */
  async rotateSession(
    userId: string,
    sessionId: string,
    context: SessionContext = NO_SESSION_CONTEXT,
  ): Promise<IssuedSession> {
    const refreshToken = await this.signRefreshToken(userId);
    const { count } = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId },
      data: {
        refreshTokenHash: this.hash(refreshToken),
        lastActiveAt: new Date(),
        ...(context.userAgent ? { userAgent: context.userAgent } : {}),
        ...(context.location ? { location: context.location } : {}),
      },
    });
    if (count === 0) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return { sessionId, refreshToken };
  }

  /**
   * Verify a refresh-token JWT and find the session holding its hash. Throws
   * UnauthorizedException on any failure, including a session that was
   * signed out. The lookup is by the hash itself (a unique index), so no
   * secret is compared byte by byte here.
   */
  async verifyRefreshToken(refreshToken: string): Promise<VerifiedRefresh> {
    const verified = await this.verifyRefreshTokenInternal(refreshToken);
    if (!verified) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }
    return verified;
  }

  /**
   * Lenient counterpart for callers (e.g. logout) that should silently
   * tolerate invalid tokens instead of surfacing a 401.
   */
  async tryVerifyRefreshToken(refreshToken: string): Promise<VerifiedRefresh | null> {
    return this.verifyRefreshTokenInternal(refreshToken);
  }

  /** The user's sessions, most recently active first. */
  async listSessions(userId: string) {
    return this.prisma.authSession.findMany({
      where: { userId },
      orderBy: [{ lastActiveAt: 'desc' }, { id: 'desc' }],
      select: { id: true, userAgent: true, location: true, createdAt: true, lastActiveAt: true },
    });
  }

  /** Sign one session out. False when the user has no such session. */
  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.authSession.deleteMany({
      where: { id: sessionId, userId },
    });
    return count > 0;
  }

  /**
   * Sign out every session of the user, or every one but `exceptSessionId`.
   * Returns how many were signed out.
   */
  async revokeSessions(userId: string, exceptSessionId?: string | null): Promise<number> {
    const { count } = await this.prisma.authSession.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
    return count;
  }

  private async signRefreshToken(userId: string): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: userId,
      type: 'refresh',
      // Two sign-ins in the same second would otherwise sign the same token,
      // and the second session could not store its hash.
      jti: randomUUID(),
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appConfigService.jwtRefreshSecret,
      expiresIn: this.appConfigService.jwtRefreshExpiresIn as never,
    });
  }

  private async verifyRefreshTokenInternal(refreshToken: string): Promise<VerifiedRefresh | null> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.appConfigService.jwtRefreshSecret,
      });
    } catch {
      return null;
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      return null;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: this.hash(refreshToken) },
      select: { id: true, user: true },
    });

    if (!session || session.user.id !== payload.sub) {
      return null;
    }

    return { user: session.user, sessionId: session.id };
  }

  private generate(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildVerificationUrl(token: string): string {
    const url = new URL('/verify-email', this.appConfigService.frontendOrigin);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private buildPasswordResetUrl(token: string): string {
    const url = new URL('/reset-password', this.appConfigService.frontendOrigin);
    url.searchParams.set('token', token);
    return url.toString();
  }
}

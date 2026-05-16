import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { AuthUser } from '@vehicle-vault/shared';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RefreshTokenPayload } from './auth.types';

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

    if (!user.emailVerificationTokenExpiresAt || user.emailVerificationTokenExpiresAt < new Date()) {
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
   * Issue a fresh refresh-token JWT, persist its SHA-256 hash on the user
   * (replacing any previous one), and return the JWT. Called after register,
   * login, and refresh — the "rotate" name reflects that every successful
   * auth flow replaces the prior refresh credential.
   */
  async rotateRefreshToken(authUser: AuthUser): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: authUser.id,
      type: 'refresh',
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.appConfigService.jwtRefreshSecret,
      expiresIn: this.appConfigService.jwtRefreshExpiresIn as never,
    });

    await this.prisma.user.update({
      where: { id: authUser.id },
      data: { refreshTokenHash: this.hash(refreshToken) },
    });

    return refreshToken;
  }

  /**
   * Verify a refresh-token JWT and confirm it matches the stored hash for
   * the claimed user. Throws UnauthorizedException on any failure. The hash
   * comparison uses `crypto.timingSafeEqual` to close the side-channel that
   * a naive `===` would expose.
   */
  async verifyRefreshToken(refreshToken: string): Promise<User> {
    const user = await this.verifyRefreshTokenInternal(refreshToken);
    if (!user) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }
    return user;
  }

  /**
   * Lenient counterpart for callers (e.g. logout) that should silently
   * tolerate invalid tokens instead of surfacing a 401.
   */
  async tryVerifyRefreshToken(refreshToken: string): Promise<User | null> {
    return this.verifyRefreshTokenInternal(refreshToken);
  }

  /**
   * Clear the persisted refresh-token hash, immediately invalidating any
   * outstanding refresh JWT for this user.
   */
  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async verifyRefreshTokenInternal(refreshToken: string): Promise<User | null> {
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

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash) {
      return null;
    }

    if (!this.timingSafeCompare(user.refreshTokenHash, this.hash(refreshToken))) {
      return null;
    }

    return user;
  }

  private generate(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBuf = Buffer.from(a, 'hex');
    const bBuf = Buffer.from(b, 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
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

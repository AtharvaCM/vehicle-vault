import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export type IssuedToken = {
  token: string;
  url: string;
};

export type ConsumedVerificationUser = {
  id: string;
  email: string;
  name: string;
};

export const EMAIL_VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_VERIFICATION_TOKEN_MESSAGE = 'Invalid or expired verification token.';

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfigService: AppConfigService,
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
    };
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
}

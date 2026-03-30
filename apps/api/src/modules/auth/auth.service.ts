import { createHash, randomBytes } from 'node:crypto';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  PasswordResetConfirmResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestResponseSchema,
  PasswordResetRequestSchema,
  RefreshTokenSchema,
  RegisterSchema,
  UserSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
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
  type VerifyEmailInput,
  type ResendVerificationInput,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { AppConfigService } from '../../config/app-config.service';
import type { LoginDto } from './dto/login.dto';
import type { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import type { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { JwtPayload, RefreshTokenPayload } from './auth.types';

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  passwordResetTokenExpiresAt?: Date | null;
  passwordResetTokenHash?: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  refreshTokenHash?: string | null;
  allowedCatalogSources: string[];
  createdAt: Date;
  updatedAt: Date;
};

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token.';
const INVALID_PASSWORD_RESET_TOKEN_MESSAGE = 'Invalid or expired password reset token.';
const PASSWORD_RESET_UNAVAILABLE_MESSAGE = 'Password reset is unavailable right now.';
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly appConfigService: AppConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(payload: RegisterDto) {
    const input = this.validateRegisterInput(payload);
    const passwordHash = await hash(input.password, 12);

    try {
      const verificationToken = randomBytes(32).toString('hex');
      const user = await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash,
          emailVerificationTokenHash: this.hashVerificationToken(verificationToken),
          emailVerified: false,
        },
      });

      await this.mailService.sendVerificationEmail({
        email: user.email,
        name: user.name,
        verificationUrl: this.buildVerificationUrl(verificationToken),
      });

      return this.buildAuthResponse(this.toUser(user));
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists.');
      }

      throw error;
    }
  }

  async login(payload: LoginDto) {
    const input = this.validateLoginInput(payload);
    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return this.buildAuthResponse(this.toUser(user));
  }

  async refresh(payload: RefreshTokenDto) {
    const input = this.validateRefreshTokenInput(payload);
    const refreshTokenPayload = await this.verifyRefreshToken(input.refreshToken);
    const user = await this.prisma.user.findUnique({
      where: {
        id: refreshTokenPayload.sub,
      },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    if (user.refreshTokenHash !== this.hashRefreshToken(input.refreshToken)) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

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

    const resetToken = randomBytes(32).toString('hex');
    const passwordResetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordResetTokenExpiresAt,
        passwordResetTokenHash: this.hashPasswordResetToken(resetToken),
      },
    });

    if (this.mailService.isConfigured) {
      try {
        await this.mailService.sendPasswordResetEmail({
          email: user.email,
          expiresAt: passwordResetTokenExpiresAt,
          name: user.name,
          resetUrl: this.buildPasswordResetUrl(resetToken),
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
            expiresAt: passwordResetTokenExpiresAt.toISOString(),
            previewToken: resetToken,
          }),
    });
  }

  async resetPassword(payload: PasswordResetConfirmDto): Promise<PasswordResetConfirmResponse> {
    const input = this.validatePasswordResetConfirmInput(payload);
    const passwordResetTokenHash = this.hashPasswordResetToken(input.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenExpiresAt: {
          gt: new Date(),
        },
        passwordResetTokenHash,
      },
    });

    if (!user) {
      throw new UnauthorizedException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await hash(input.password, 12);

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordHash,
        passwordResetTokenExpiresAt: null,
        passwordResetTokenHash: null,
        refreshTokenHash: null,
      },
    });

    return PasswordResetConfirmResponseSchema.parse({
      reset: true,
    });
  }

  async verifyEmail(payload: VerifyEmailDto) {
    const input = this.validateVerifyEmailInput(payload);
    const emailVerificationTokenHash = this.hashVerificationToken(input.token);

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationTokenHash,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification token.');
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
      },
    });

    return { verified: true };
  }

  async resendVerification(payload: ResendVerificationDto) {
    const input = this.validateResendVerificationInput(payload);
    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email.trim().toLowerCase(),
      },
    });

    if (!user || user.emailVerified) {
      return { accepted: true };
    }

    const verificationToken = randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        emailVerificationTokenHash: this.hashVerificationToken(verificationToken),
      },
    });

    await this.mailService.sendVerificationEmail({
      email: user.email,
      name: user.name,
      verificationUrl: this.buildVerificationUrl(verificationToken),
    });

    return { accepted: true };
  }

  async logout(payload: RefreshTokenDto) {
    const input = this.validateRefreshTokenInput(payload);
    const refreshTokenPayload = await this.tryVerifyRefreshToken(input.refreshToken);

    if (!refreshTokenPayload) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: refreshTokenPayload.sub,
      },
    });

    if (!user?.refreshTokenHash) {
      return;
    }

    if (user.refreshTokenHash !== this.hashRefreshToken(input.refreshToken)) {
      return;
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash: null,
      },
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

  private buildVerificationUrl(token: string) {
    const url = new URL('/verify-email', this.appConfigService.frontendOrigin);
    url.searchParams.set('token', token);

    return url.toString();
  }

  private buildPasswordResetUrl(token: string) {
    const resetUrl = new URL('/reset-password', this.appConfigService.frontendOrigin);
    resetUrl.searchParams.set('token', token);

    return resetUrl.toString();
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const authUser = this.toAuthUser(user);
    const accessToken = await this.signAccessToken(authUser);
    const refreshToken = await this.signRefreshToken(authUser);

    await this.persistRefreshToken(user.id, refreshToken);

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

  private async signRefreshToken(authUser: AuthUser) {
    const payload: RefreshTokenPayload = {
      sub: authUser.id,
      type: 'refresh',
    };

    return this.jwtService.signAsync(payload, {
      secret: this.appConfigService.jwtRefreshSecret,
      expiresIn: this.appConfigService.jwtRefreshExpiresIn as never,
    });
  }

  private async verifyRefreshToken(refreshToken: string) {
    const payload = await this.tryVerifyRefreshToken(refreshToken);

    if (!payload) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    return payload;
  }

  private async tryVerifyRefreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.appConfigService.jwtRefreshSecret,
      });

      if (payload.type !== 'refresh' || !payload.sub) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: this.hashRefreshToken(refreshToken),
      },
    });
  }

  private hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashVerificationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
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

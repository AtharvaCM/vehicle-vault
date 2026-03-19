import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import {
  AuthResponseSchema,
  AuthUserSchema,
  LoginSchema,
  RegisterSchema,
  UserSchema,
  type AuthResponse,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
        },
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
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.buildAuthResponse(this.toUser(user));
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
    const payload: JwtPayload = {
      sub: authUser.id,
      email: authUser.email,
      name: authUser.name,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return AuthResponseSchema.parse({
      user: authUser,
      accessToken,
    });
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

  private toUser(user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return UserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  }

  private toAuthUser(user: User): AuthUser {
    return AuthUserSchema.parse({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  }
}

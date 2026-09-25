import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentSessionId } from '../../common/auth/decorators/current-session-id.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Public } from '../../common/auth/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import type { AuthUser } from '@vehicle-vault/shared';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordChangeDto } from './dto/password-change.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { CurrentSessionContext, type SessionContext } from './session-context';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit('register')
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() body: RegisterDto, @CurrentSessionContext() context: SessionContext) {
    return successResponse(await this.authService.register(body, context));
  }

  /**
   * Rate-limited inside `AuthService.login` rather than by `@RateLimit`: a guard
   * refuses before the handler runs, and a refused login still has to leave its
   * `auth.login_failed` event behind for the account it was aimed at.
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  async login(
    @Body() body: LoginDto,
    @Ip() clientIp: string,
    @CurrentSessionContext() context: SessionContext,
  ) {
    return successResponse(await this.authService.login(body, clientIp, context));
  }

  @Public()
  @RateLimit('token')
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh authentication token' })
  async refresh(@Body() body: RefreshTokenDto, @CurrentSessionContext() context: SessionContext) {
    return successResponse(await this.authService.refresh(body, context));
  }

  @Public()
  @RateLimit('mail')
  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request password reset email' })
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return successResponse(await this.authService.requestPasswordReset(body));
  }

  @Public()
  @RateLimit('token')
  @Post('password-reset/confirm')
  @ApiOperation({ summary: 'Confirm password reset' })
  async resetPassword(@Body() body: PasswordResetConfirmDto) {
    return successResponse(await this.authService.resetPassword(body));
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify user email' })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    return successResponse(await this.authService.verifyEmail(body));
  }

  @Public()
  @RateLimit('mail')
  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  async resendVerification(@Body() body: ResendVerificationDto) {
    return successResponse(await this.authService.resendVerification(body));
  }

  /** Settings → Security: a new password, keeping this session and ending the rest. */
  @RateLimit('token')
  @Post('password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change (or first set) the password of the signed-in account' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @CurrentSessionId() sessionId: string | null,
    @CurrentSessionContext() context: SessionContext,
    @Body() body: PasswordChangeDto,
  ) {
    return successResponse(
      await this.authService.changePassword(user.id, body, sessionId, context),
    );
  }

  /** Settings → Security: where this account is signed in. */
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: "The signed-in account's sessions, most recently active first" })
  async listSessions(@CurrentUser() user: AuthUser, @CurrentSessionId() sessionId: string | null) {
    return successResponse(await this.authService.listSessions(user.id, sessionId));
  }

  /** Declared before `sessions/:sessionId`, so "others" is never read as an id. */
  @RateLimit('token')
  @Delete('sessions/others')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out every session but this one' })
  async revokeOtherSessions(
    @CurrentUser() user: AuthUser,
    @CurrentSessionId() sessionId: string | null,
  ) {
    return successResponse(await this.authService.revokeOtherSessions(user.id, sessionId));
  }

  @RateLimit('token')
  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out one session' })
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @CurrentSessionId() currentSessionId: string | null,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return successResponse(
      await this.authService.revokeSession(user.id, sessionId, currentSessionId),
    );
  }

  @Get('security')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'How the signed-in account can sign in' })
  async getSecurity(@CurrentUser() user: AuthUser) {
    return successResponse(await this.authService.getSecurity(user.id));
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Logout a user' })
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body);

    return successResponse({ revoked: true });
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser() user: AuthUser) {
    return successResponse(await this.authService.getMe(user.id));
  }
}

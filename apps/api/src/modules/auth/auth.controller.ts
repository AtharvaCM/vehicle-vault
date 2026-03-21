import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Public } from '../../common/auth/decorators/public.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import type { AuthUser } from '@vehicle-vault/shared';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return successResponse(await this.authService.register(body));
  }

  @Public()
  @Post('login')
  async login(@Body() body: LoginDto) {
    return successResponse(await this.authService.login(body));
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: RefreshTokenDto) {
    return successResponse(await this.authService.refresh(body));
  }

  @Public()
  @Post('logout')
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body);

    return successResponse({ revoked: true });
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return successResponse(await this.authService.getMe(user.id));
  }
}

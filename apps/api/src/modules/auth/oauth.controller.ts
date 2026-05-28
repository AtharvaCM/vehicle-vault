import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OAuthProvider } from '@prisma/client';

import { Public } from '../../common/auth/decorators/public.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { AppConfigService } from '../../config/app-config.service';
import { OAuthService, type OAuthProfile } from './oauth.service';

type RequestWithOAuthUser = { user?: OAuthProfile };
type RedirectResponse = { redirect: (url: string) => void };

const PROVIDERS: ReadonlyArray<OAuthProvider> = [OAuthProvider.google, OAuthProvider.github];

@ApiTags('Auth')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List configured OAuth providers' })
  listProviders() {
    const providers: OAuthProvider[] = [];
    if (this.appConfigService.isGoogleOAuthConfigured) providers.push(OAuthProvider.google);
    if (this.appConfigService.isGithubOAuthConfigured) providers.push(OAuthProvider.github);
    return successResponse({ providers });
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Begin Google OAuth flow' })
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  beginGoogle() {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: RequestWithOAuthUser, @Res() res: RedirectResponse) {
    await this.handleCallback(req, res);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Begin GitHub OAuth flow' })
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  beginGithub() {}

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(@Req() req: RequestWithOAuthUser, @Res() res: RedirectResponse) {
    await this.handleCallback(req, res);
  }

  @Public()
  @Get(':provider')
  unknownProviderBegin(@Param('provider') provider: string) {
    this.assertKnownProvider(provider);
    throw new NotFoundException(`OAuth provider '${provider}' is not configured.`);
  }

  private assertKnownProvider(provider: string) {
    if (!PROVIDERS.includes(provider as OAuthProvider)) {
      throw new BadRequestException(`Unknown OAuth provider: ${provider}`);
    }
  }

  private async handleCallback(req: RequestWithOAuthUser, res: RedirectResponse) {
    const profile = req.user;
    if (!profile) {
      res.redirect(this.buildRedirect({ error: 'oauth_no_profile' }));
      return;
    }
    try {
      const response = await this.oauthService.loginOrLink(profile);
      res.redirect(
        this.buildRedirect({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'oauth_login_failed';
      res.redirect(this.buildRedirect({ error: message }));
    }
  }

  private buildRedirect(fragment: Record<string, string>) {
    const base = this.appConfigService.oauthFrontendRedirectUrl;
    const params = new URLSearchParams(fragment);
    return `${base}#${params.toString()}`;
  }
}

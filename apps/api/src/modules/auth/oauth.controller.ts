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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OAuthProvider } from '@prisma/client';
import { toSafeReturnPath } from '@vehicle-vault/shared';

import { Public } from '../../common/auth/decorators/public.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { AppConfigService } from '../../config/app-config.service';
import { OAuthCallbackGuard, type OAuthCallbackRequest } from './oauth-callback.guard';
import { toCatalogModel, type OAuthStateInfo } from './oauth-state';
import { OAuthService, type OAuthProfile } from './oauth.service';

type RequestWithOAuthUser = OAuthCallbackRequest & { user?: OAuthProfile };
type RedirectResponse = { redirect: (url: string) => void };

const PROVIDERS: ReadonlyArray<OAuthProvider> = [OAuthProvider.google, OAuthProvider.github];

const CATALOG_MODEL_QUERY = {
  name: 'catalogModel',
  required: false,
  description:
    'Slug of the catalog model whose public page led here. Carried in the signed OAuth state and used only to attribute a new account; an invalid slug is ignored.',
};

const NEXT_QUERY = {
  name: 'next',
  required: false,
  description:
    'Same-origin path the web app returns to after sign-in. Carried in the signed OAuth state and handed back in the callback fragment; anything but a same-origin path is ignored.',
};

function stateFrom(authInfo: unknown): OAuthStateInfo | undefined {
  if (!authInfo || typeof authInfo !== 'object') return undefined;
  return (authInfo as { state?: OAuthStateInfo }).state;
}

/** The model slug a verified OAuth state carried, if any. */
function catalogModelFrom(authInfo: unknown): string | undefined {
  return toCatalogModel(stateFrom(authInfo)?.catalogModel);
}

/** The return path a verified OAuth state carried, if any. */
function nextFrom(authInfo: unknown): string | undefined {
  return toSafeReturnPath(stateFrom(authInfo)?.next);
}

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
  @ApiQuery(CATALOG_MODEL_QUERY)
  @ApiQuery(NEXT_QUERY)
  beginGoogle() {}

  @Public()
  @Get('google/callback')
  @UseGuards(OAuthCallbackGuard(OAuthProvider.google))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Req() req: RequestWithOAuthUser, @Res() res: RedirectResponse) {
    await this.handleCallback(req, res);
  }

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Begin GitHub OAuth flow' })
  @ApiQuery(CATALOG_MODEL_QUERY)
  @ApiQuery(NEXT_QUERY)
  beginGithub() {}

  @Public()
  @Get('github/callback')
  @UseGuards(OAuthCallbackGuard(OAuthProvider.github))
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
    // Handed back either way, so a failed attempt's "Back to sign in" keeps it.
    const next = nextFrom(req.authInfo);
    const withNext: Record<string, string> = next ? { next } : {};
    if (!profile) {
      res.redirect(
        this.buildRedirect({ error: req.oauthFailure ?? 'oauth_no_profile', ...withNext }),
      );
      return;
    }
    try {
      const response = await this.oauthService.loginOrLink(profile, {
        catalogModel: catalogModelFrom(req.authInfo),
      });
      res.redirect(
        this.buildRedirect({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          ...withNext,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : 'oauth_login_failed';
      res.redirect(this.buildRedirect({ error: message, ...withNext }));
    }
  }

  private buildRedirect(fragment: Record<string, string>) {
    const base = this.appConfigService.oauthFrontendRedirectUrl;
    const params = new URLSearchParams(fragment);
    return `${base}#${params.toString()}`;
  }
}

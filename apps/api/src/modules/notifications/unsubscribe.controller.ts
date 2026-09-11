import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';

import { AlertEmailPreferenceService } from './alert-email-preference.service';
import { UnsubscribeTokenService } from './unsubscribe-token.service';
import { Public } from '../../common/auth/decorators/public.decorator';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Just enough of the underlying HTTP response to set a status code. Structural
 * rather than `express.Response` so the API keeps no direct dependency on the
 * HTTP adapter's types for one method call.
 */
type StatusSettable = { status(code: number): unknown };

/**
 * The other end of the link in every alert email.
 *
 * Unauthenticated by necessity: a person clicking "unsubscribe" in their mail
 * client is not signed in, and requiring a login to stop email is the pattern
 * this feature exists to avoid. The signed token is the whole credential, and
 * all it can do is mute alert email for the user it names.
 *
 * Serves HTML rather than JSON because the caller is a browser opened by a mail
 * client. The page is deliberately self-contained — no stylesheet, no script,
 * no call back to the web app — so it renders even when the frontend is down,
 * which is exactly when someone is most likely to be trying to leave.
 */
@Controller('notifications')
export class UnsubscribeController {
  constructor(
    private readonly preferences: AlertEmailPreferenceService,
    private readonly tokens: UnsubscribeTokenService,
    private readonly appConfigService: AppConfigService,
  ) {}

  @Public()
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // StreamableFile is how this codebase returns anything that is not JSON — the
  // response interceptor leaves it alone, and so does the Express adapter,
  // which would otherwise JSON-serialize a bare Buffer into `{"type":"Buffer"}`
  // and send that under a text/html header.
  async unsubscribe(
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: StatusSettable,
  ): Promise<StreamableFile> {
    const userId = token ? this.tokens.verify(token) : null;

    if (!userId) {
      res.status(400);
      return this.page(
        'This link is not valid',
        'It may have been altered in transit or truncated by your mail client. You can turn alert emails off from Settings instead.',
      );
    }

    try {
      await this.preferences.mute(userId, { actorUserId: null });
    } catch {
      // The token verified, so the signature was ours; the only way through
      // here is an account that has since gone. Nothing was sent to it either.
      res.status(400);
      return this.page(
        'This link is not valid',
        'The account it points to no longer exists, so there is nothing left to unsubscribe.',
      );
    }

    return this.page(
      'Alert emails are off',
      'We will stop emailing you maintenance alerts. You will still see them in the app and in push notifications, and you can turn email back on any time from Settings.',
    );
  }

  /**
   * RFC 8058 one-click. The mail client POSTs here by itself, with no browser
   * and nobody to read a page, so this returns an empty 200 and never HTML.
   */
  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribeOneClick(
    @Query('token') token: string | undefined,
    @Res({ passthrough: true }) res: StatusSettable,
  ): Promise<void> {
    const userId = token ? this.tokens.verify(token) : null;

    if (!userId) {
      res.status(400);
      return;
    }

    try {
      await this.preferences.mute(userId, { actorUserId: null });
    } catch {
      res.status(400);
    }
  }

  private page(heading: string, body: string): StreamableFile {
    const settingsUrl = new URL('/settings', this.appConfigService.frontendOrigin).toString();

    return new StreamableFile(
      Buffer.from(
        [
          '<!doctype html>',
          '<html lang="en"><head><meta charset="utf-8">',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<meta name="robots" content="noindex">',
          `<title>${escapeHtml(heading)} — Vehicle Vault</title></head>`,
          '<body style="margin:0;padding:48px 20px;background:#f8fafc;font-family:system-ui,sans-serif;color:#475569;">',
          '<main style="max-width:520px;margin:0 auto;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">',
          '<h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0f172a;">Vehicle Vault</h1>',
          `<h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a;">${escapeHtml(heading)}</h2>`,
          `<p style="margin:0 0 24px;font-size:14px;line-height:22px;">${escapeHtml(body)}</p>`,
          `<p style="margin:0;font-size:14px;"><a href="${escapeAttribute(settingsUrl)}" style="color:#0f172a;">Open Vehicle Vault settings</a></p>`,
          '</main></body></html>',
        ].join(''),
        'utf8',
      ),
      { type: 'text/html; charset=utf-8' },
    );
  }
}

function escapeAttribute(value: string) {
  return value.replace(/"/g, '&quot;');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import { NotFoundException, StreamableFile } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UnsubscribeController } from './unsubscribe.controller';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

describe('UnsubscribeController', () => {
  const preferences = { mute: vi.fn() };
  const appConfig = { frontendOrigin: 'https://app.example', jwtSecret: 'test-secret' };
  const tokens = new UnsubscribeTokenService(appConfig as never);

  let controller: UnsubscribeController;
  let res: { status: ReturnType<typeof vi.fn> };

  /**
   * Reads the page back the way the HTTP adapter will. Going through
   * StreamableFile rather than a Buffer is not cosmetic: Express JSON-encodes a
   * returned Buffer, so a page built that way reaches the browser as
   * `{"type":"Buffer"}` under a text/html header.
   */
  const html = (file: StreamableFile) => file.getStream().read().toString('utf8');

  beforeEach(() => {
    vi.clearAllMocks();
    preferences.mute.mockResolvedValue({ muted: true, mutedAt: new Date() });
    res = { status: vi.fn() };
    controller = new UnsubscribeController(preferences as never, tokens, appConfig as never);
  });

  describe('GET', () => {
    it('mutes the user the token names and confirms it in a page', async () => {
      const page = html(await controller.unsubscribe(tokens.issue('user-1'), res as never));

      expect(preferences.mute).toHaveBeenCalledWith('user-1', { actorUserId: null });
      expect(res.status).not.toHaveBeenCalled();
      expect(page).toContain('Alert emails are off');
    });

    it('tells the reader the in-app and push alerts are unaffected', async () => {
      const page = html(await controller.unsubscribe(tokens.issue('user-1'), res as never));

      expect(page).toContain('still see them in the app');
    });

    it('links to the notification preferences so the decision is reversible', async () => {
      const page = html(await controller.unsubscribe(tokens.issue('user-1'), res as never));

      expect(page).toContain('https://app.example/settings/preferences');
    });

    it('rejects a tampered token without touching the preference', async () => {
      const [payload] = tokens.issue('user-1').split('.');

      const page = html(await controller.unsubscribe(`${payload}.forged`, res as never));

      expect(preferences.mute).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(page).toContain('This link is not valid');
    });

    it('rejects a missing token', async () => {
      const page = html(await controller.unsubscribe(undefined, res as never));

      expect(preferences.mute).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(page).toContain('This link is not valid');
    });

    it('renders a page rather than a stack trace when the account has gone', async () => {
      preferences.mute.mockRejectedValue(new NotFoundException('gone'));

      const page = html(await controller.unsubscribe(tokens.issue('user-1'), res as never));

      expect(res.status).toHaveBeenCalledWith(400);
      expect(page).toContain('no longer exists');
    });

    it('cannot be made to break out of the href by a hostile frontend origin', async () => {
      // `new URL` normalises the configured origin before it is interpolated,
      // and the attribute escape is the second line. Asserting the rendered
      // href rather than either mechanism, so replacing one still fails this.
      appConfig.frontendOrigin = 'https://app.example/"onload="alert(1)';
      controller = new UnsubscribeController(preferences as never, tokens, appConfig as never);

      const page = html(await controller.unsubscribe(tokens.issue('user-1'), res as never));

      expect(page).toContain('href="https://app.example/settings/preferences"');
      expect(page).not.toContain('onload=');
    });
  });

  describe('POST (RFC 8058 one-click)', () => {
    it('mutes without rendering anything for a caller that is not a browser', async () => {
      const body = await controller.unsubscribeOneClick(tokens.issue('user-1'), res as never);

      expect(preferences.mute).toHaveBeenCalledWith('user-1', { actorUserId: null });
      expect(res.status).not.toHaveBeenCalled();
      expect(body).toBeUndefined();
    });

    it('rejects a bad token with a status, not a page', async () => {
      const body = await controller.unsubscribeOneClick('garbage', res as never);

      expect(preferences.mute).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(body).toBeUndefined();
    });

    it('does not throw at the mail client when the account has gone', async () => {
      preferences.mute.mockRejectedValue(new NotFoundException('gone'));

      await expect(
        controller.unsubscribeOneClick(tokens.issue('user-1'), res as never),
      ).resolves.toBeUndefined();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

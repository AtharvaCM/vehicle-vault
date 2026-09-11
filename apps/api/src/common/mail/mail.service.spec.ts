import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MailService } from './mail.service';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: (...args: unknown[]) => sendMail(...args) }),
}));

describe('MailService alert email', () => {
  const appConfig = {
    smtpUrl: 'smtp://localhost:1025',
    smtpHost: null,
    mailFrom: 'Vehicle Vault <alerts@example.com>',
    mailReplyTo: null,
  };

  let service: MailService;

  const send = () =>
    service.sendMaintenanceAlert({
      email: 'atharva@example.com',
      userName: 'Atharva',
      vehicleName: 'Silver Bullet',
      alertTitle: 'Service Due Soon: Engine Oil',
      message: 'Your Engine Oil is due in approx. 200 km.',
      unsubscribeUrl: 'https://vault.example/api/notifications/unsubscribe?token=abc.def',
    });

  const sent = () => sendMail.mock.calls[0][0];

  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue(undefined);
    service = new MailService(appConfig as never);
  });

  it('carries the unsubscribe link in both the HTML and the plain-text body', async () => {
    await send();

    expect(sent().html).toContain(
      'https://vault.example/api/notifications/unsubscribe?token=abc.def',
    );
    expect(sent().text).toContain(
      'https://vault.example/api/notifications/unsubscribe?token=abc.def',
    );
  });

  it('sets List-Unsubscribe so the mail client offers its own control', async () => {
    await send();

    expect(sent().headers).toEqual({
      'List-Unsubscribe': '<https://vault.example/api/notifications/unsubscribe?token=abc.def>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('says the opt-out stops email only, not the alerts themselves', async () => {
    await send();

    expect(sent().text).toContain('still see alerts in the app');
    expect(sent().html).toContain('still see alerts in the app');
  });

  it('leaves transactional mail without an unsubscribe header', async () => {
    // A password reset the recipient just asked for is not bulk mail, and an
    // opt-out on it would let someone lock themselves out of their own account.
    await service.sendPasswordResetEmail({
      email: 'atharva@example.com',
      name: 'Atharva',
      resetUrl: 'https://app.example/reset-password?token=x',
      expiresAt: new Date('2026-09-11T07:00:00.000Z'),
    });

    expect(sent().headers).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContactService } from './contact.service';

describe('ContactService', () => {
  const prisma = { contactMessage: { create: vi.fn(), findMany: vi.fn() } };
  const mail = { isConfigured: false, sendContactMessage: vi.fn() };
  const appConfig = { adminEmails: ['owner@example.test', 'second@example.test'] };
  let service: ContactService;

  const message = {
    name: 'Asha',
    email: 'asha@example.test',
    message: 'The Creta page lists the wrong tyre size.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mail.isConfigured = false;
    prisma.contactMessage.create.mockResolvedValue({ id: 'm1' });
    service = new ContactService(prisma as never, mail as never, appConfig as never);
  });

  it('stores a message, and mails nothing while mail is off', async () => {
    await expect(service.receive(message)).resolves.toEqual({ received: true });

    expect(prisma.contactMessage.create).toHaveBeenCalledWith({ data: message });
    expect(mail.sendContactMessage).not.toHaveBeenCalled();
  });

  it('mails each admin once mail is on, and a failed mail loses nothing', async () => {
    mail.isConfigured = true;
    mail.sendContactMessage.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.receive(message)).resolves.toEqual({ received: true });

    expect(mail.sendContactMessage).toHaveBeenCalledTimes(2);
    expect(mail.sendContactMessage).toHaveBeenCalledWith({ to: 'second@example.test', ...message });
  });

  it('thanks a bot that filled the honeypot, and keeps nothing', async () => {
    await expect(service.receive({ ...message, website: 'spam.example' })).resolves.toEqual({
      received: true,
    });
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('lists messages newest first for the admin area', async () => {
    prisma.contactMessage.findMany.mockResolvedValue([
      { id: 'm1', ...message, createdAt: new Date('2026-09-26T10:00:00.000Z') },
    ]);

    await expect(service.list()).resolves.toEqual([
      { id: 'm1', ...message, createdAt: '2026-09-26T10:00:00.000Z' },
    ]);
    expect(prisma.contactMessage.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
});

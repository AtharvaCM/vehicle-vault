import { AuditResourceType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertEmailPreferenceService } from './alert-email-preference.service';

const MUTED_AT = new Date('2026-09-11T06:00:00.000Z');

describe('AlertEmailPreferenceService', () => {
  const tx = {
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { track: vi.fn() };

  let service: AlertEmailPreferenceService;

  /** The row as it stands before the call, and what `update` should return after. */
  const given = (before: Date | null, after: Date | null) => {
    tx.user.findUnique.mockResolvedValue({ alertEmailsMutedAt: before });
    tx.user.update.mockResolvedValue({ alertEmailsMutedAt: after });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
    service = new AlertEmailPreferenceService(prisma as never, audit as never);
  });

  describe('mute', () => {
    it('stamps the row and records who did it', async () => {
      given(null, MUTED_AT);

      expect(await service.mute('user-1', { actorUserId: 'user-1' })).toEqual({
        muted: true,
        mutedAt: MUTED_AT,
      });
      expect(audit.track).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'notification.alert_email_muted',
          actorUserId: 'user-1',
          ownerUserId: 'user-1',
          resourceType: AuditResourceType.user,
          resourceId: 'user-1',
        }),
      );
    });

    it('records no actor when the mute came from an unsubscribe link', async () => {
      // The token proves control of the mailbox, not of a session. Naming the
      // user as actor would claim they were signed in when they were not.
      given(null, MUTED_AT);

      await service.mute('user-1', { actorUserId: null });

      expect(audit.track).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ actorUserId: null, ownerUserId: 'user-1' }),
      );
    });

    it('is idempotent: a second click changes nothing and audits nothing', async () => {
      // Mail clients prefetch links, and people click old ones twice.
      given(MUTED_AT, MUTED_AT);

      expect(await service.mute('user-1', { actorUserId: null })).toEqual({
        muted: true,
        mutedAt: MUTED_AT,
      });
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(audit.track).not.toHaveBeenCalled();
    });

    it('refuses an account that no longer exists rather than letting update throw', async () => {
      tx.user.findUnique.mockResolvedValue(null);

      await expect(service.mute('gone', { actorUserId: null })).rejects.toThrow(
        'That account no longer exists.',
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });

  it('writes the row and the audit event in one transaction', async () => {
    // Otherwise a crash between them leaves a muted user with no trail, which
    // is precisely the complaint this audit exists to answer.
    given(null, MUTED_AT);

    await service.mute('user-1', { actorUserId: 'user-1' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(audit.track.mock.calls[0][0]).toBe(tx);
  });
});

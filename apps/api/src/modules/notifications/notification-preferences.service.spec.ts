import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';
import { ALERT_KINDS, type AlertKind } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationPreferencesService } from './notification-preferences.service';

const UNSUBSCRIBED_AT = new Date('2026-09-11T06:00:00.000Z');

type Row = { kind: string; emailEnabled: boolean; pushEnabled: boolean };

/**
 * One user's stored preferences, answered the way Prisma would for the queries
 * the service makes. Writes land in the same store, so a test reads back the
 * state it produced rather than the calls that produced it.
 */
function store(initial: { mutedAt?: Date | null; rows?: Row[]; exists?: boolean } = {}) {
  const state = {
    exists: initial.exists ?? true,
    alertEmailsMutedAt: initial.mutedAt ?? null,
    rows: new Map((initial.rows ?? []).map((row) => [row.kind, { ...row }])),
  };

  const read = () =>
    state.exists
      ? {
          alertEmailsMutedAt: state.alertEmailsMutedAt,
          notificationPreferences: [...state.rows.values()].map((row) => ({ ...row })),
        }
      : null;

  const tx = {
    user: {
      findUnique: vi.fn(async () => read()),
      update: vi.fn(async ({ data }: { data: { alertEmailsMutedAt: Date | null } }) => {
        state.alertEmailsMutedAt = data.alertEmailsMutedAt;
      }),
    },
    notificationPreference: {
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { userId_kind: { kind: string } };
          update: { emailEnabled: boolean; pushEnabled: boolean };
        }) => {
          const kind = where.userId_kind.kind;
          state.rows.set(kind, { kind, ...update });
        },
      ),
    },
  };

  const prisma = {
    user: { findUnique: vi.fn(async () => read()) },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };

  return { state, tx, prisma };
}

const audit = { track: vi.fn() };

function serviceOver(db: ReturnType<typeof store>) {
  return new NotificationPreferencesService(db.prisma as never, audit as never);
}

/** The response as a kind → delivery map, which is what the assertions care about. */
function byKind(response: { preferences: { kind: AlertKind; email: boolean; push: boolean }[] }) {
  return Object.fromEntries(
    response.preferences.map(({ kind, email, push }) => [kind, { email, push }]),
  );
}

const allOn = Object.fromEntries(ALERT_KINDS.map((kind) => [kind, { email: true, push: true }]));

describe('NotificationPreferencesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('reads every kind as on for a user who has chosen nothing', async () => {
      const response = await serviceOver(store()).get('user-1');

      expect(response.preferences.map((preference) => preference.kind)).toEqual([...ALERT_KINDS]);
      expect(byKind(response)).toEqual(allOn);
    });

    it('reads a stored choice for its kind and the default for the rest', async () => {
      const db = store({
        rows: [{ kind: 'tyre-uninspected', emailEnabled: false, pushEnabled: true }],
      });

      expect(byKind(await serviceOver(db).get('user-1'))).toEqual({
        ...allOn,
        'tyre-uninspected': { email: false, push: true },
      });
    });

    it('reads every email as off after the unsubscribe link, whatever the rows say', async () => {
      const db = store({
        mutedAt: UNSUBSCRIBED_AT,
        rows: [{ kind: 'maintenance-due', emailEnabled: true, pushEnabled: false }],
      });

      const preferences = byKind(await serviceOver(db).get('user-1'));

      expect(Object.values(preferences).every((delivery) => !delivery.email)).toBe(true);
      // The unsubscribe is about email; push stays as chosen.
      expect(preferences['maintenance-due']).toEqual({ email: false, push: false });
      expect(preferences['reminder-due']).toEqual({ email: false, push: true });
    });

    it('refuses an account that no longer exists', async () => {
      await expect(serviceOver(store({ exists: false })).get('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('saves a choice and records it in the activity log', async () => {
      const db = store();

      const response = await serviceOver(db).update(
        'user-1',
        [{ kind: 'tyre-uninspected', email: false, push: true }],
        { actorUserId: 'user-1' },
      );

      expect(db.state.rows.get('tyre-uninspected')).toEqual({
        kind: 'tyre-uninspected',
        emailEnabled: false,
        pushEnabled: true,
      });
      expect(db.state.rows.size).toBe(1);
      expect(byKind(response)['tyre-uninspected']).toEqual({ email: false, push: true });
      expect(audit.track).toHaveBeenCalledWith(db.tx, {
        actorUserId: 'user-1',
        ownerUserId: 'user-1',
        action: 'notification.preferences_updated',
        resourceType: AuditResourceType.user,
        resourceId: 'user-1',
        // Only the kinds that changed, so the entry says what happened.
        before: { 'tyre-uninspected': { email: true, push: true } },
        after: { 'tyre-uninspected': { email: false, push: true } },
      });
    });

    it('writes nothing and records nothing when nothing changes', async () => {
      const db = store({
        rows: [{ kind: 'tyre-aged', emailEnabled: false, pushEnabled: false }],
      });

      await serviceOver(db).update(
        'user-1',
        [
          { kind: 'tyre-aged', email: false, push: false },
          { kind: 'reminder-due', email: true, push: true },
        ],
        { actorUserId: 'user-1' },
      );

      expect(db.tx.notificationPreference.upsert).not.toHaveBeenCalled();
      expect(db.tx.user.update).not.toHaveBeenCalled();
      expect(audit.track).not.toHaveBeenCalled();
    });

    it('treats every email turned off as the same state the unsubscribe link sets', async () => {
      const db = store();

      await serviceOver(db).update(
        'user-1',
        ALERT_KINDS.map((kind) => ({ kind, email: false, push: true })),
        { actorUserId: 'user-1' },
      );

      expect(db.state.alertEmailsMutedAt).toBeInstanceOf(Date);
    });

    it('keeps the original unsubscribe time when email was already all off', async () => {
      const db = store({ mutedAt: UNSUBSCRIBED_AT });

      await serviceOver(db).update('user-1', [{ kind: 'tyre-worn', email: false, push: false }], {
        actorUserId: 'user-1',
      });

      expect(db.state.alertEmailsMutedAt).toBe(UNSUBSCRIBED_AT);
    });

    it('turns one kind back on after unsubscribing, and only that kind', async () => {
      // Rows still say "on" from before the unsubscribe. The toggles showed them
      // off, so clearing the mute must not bring them back with it.
      const db = store({
        mutedAt: UNSUBSCRIBED_AT,
        rows: [{ kind: 'reminder-due', emailEnabled: true, pushEnabled: true }],
      });

      const response = await serviceOver(db).update(
        'user-1',
        [{ kind: 'maintenance-overdue', email: true, push: true }],
        { actorUserId: 'user-1' },
      );

      expect(db.state.alertEmailsMutedAt).toBeNull();
      const emailOn = response.preferences
        .filter((preference) => preference.email)
        .map((preference) => preference.kind);
      expect(emailOn).toEqual(['maintenance-overdue']);
      // And the stored rows agree with what the response says.
      expect(byKind(await serviceOver(db).get('user-1'))).toEqual(byKind(response));
    });

    it('rejects the same kind twice rather than guessing which one was meant', async () => {
      const db = store();

      await expect(
        serviceOver(db).update(
          'user-1',
          [
            { kind: 'tyre-worn', email: false, push: true },
            { kind: 'tyre-worn', email: true, push: true },
          ],
          { actorUserId: 'user-1' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses an account that no longer exists', async () => {
      const db = store({ exists: false });

      await expect(
        serviceOver(db).update('user-1', [{ kind: 'tyre-worn', email: false, push: true }], {
          actorUserId: 'user-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.track).not.toHaveBeenCalled();
    });

    it('reads and writes inside one transaction', async () => {
      const db = store();

      await serviceOver(db).update(
        'user-1',
        ALERT_KINDS.map((kind) => ({ kind, email: false, push: true })),
        { actorUserId: 'user-1' },
      );

      expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(db.prisma.user.findUnique).not.toHaveBeenCalled();
      expect(db.tx.user.findUnique).toHaveBeenCalledTimes(1);
      expect(audit.track).toHaveBeenCalledWith(db.tx, expect.anything());
    });
  });
});

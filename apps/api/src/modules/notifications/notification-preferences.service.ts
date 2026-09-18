import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';
import {
  ALERT_KINDS,
  type AlertKind,
  type NotificationPreference,
  type NotificationPreferences,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';

type Delivery = { email: boolean; push: boolean };

type StoredPreferences = {
  alertEmailsMutedAt: Date | null;
  notificationPreferences: { kind: string; emailEnabled: boolean; pushEnabled: boolean }[];
};

const STORED_SELECT = {
  alertEmailsMutedAt: true,
  notificationPreferences: { select: { kind: true, emailEnabled: true, pushEnabled: true } },
} as const;

/**
 * Which channels deliver each kind of alert to a user.
 *
 * Two things decide email, and they are presented as one: a row per kind, and
 * `User.alertEmailsMutedAt`, which the one-click unsubscribe sets. While that is
 * set every email toggle reads off, whatever the rows say. Saving keeps them in
 * step — every email toggle off sets it, any toggle on clears it — so turning a
 * single kind back on after unsubscribing delivers that kind and only that kind.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const stored = await this.prisma.user.findUnique({
      where: { id: userId },
      select: STORED_SELECT,
    });

    if (!stored) {
      throw new NotFoundException('That account no longer exists.');
    }

    return toResponse(effectiveDeliveries(stored));
  }

  /**
   * Applies the given kinds on top of what the user sees now; kinds left out
   * keep their current setting. Changing nothing writes nothing and records
   * nothing, so a double-submitted form does not fill the activity log.
   */
  async update(
    userId: string,
    changes: NotificationPreference[],
    options: { actorUserId: string },
  ): Promise<NotificationPreferences> {
    const kinds = changes.map((change) => change.kind);
    if (new Set(kinds).size !== kinds.length) {
      throw new BadRequestException('Each alert kind can only appear once.');
    }

    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.user.findUnique({ where: { id: userId }, select: STORED_SELECT });

      if (!stored) {
        throw new NotFoundException('That account no longer exists.');
      }

      const before = effectiveDeliveries(stored);
      const after = new Map(before);
      for (const change of changes) {
        after.set(change.kind, { email: change.email, push: change.push });
      }

      const changedKinds = ALERT_KINDS.filter(
        (kind) => !sameDelivery(before.get(kind), after.get(kind)),
      );
      if (changedKinds.length === 0) {
        return toResponse(before);
      }

      // The rows are written from the state the user was looking at, not from
      // what they held underneath a mute: a kind whose row still says "email
      // on" from before an unsubscribe must not come back on by itself when an
      // unrelated toggle clears the mute.
      const rows = storedRows(stored);
      for (const kind of ALERT_KINDS) {
        const wanted = after.get(kind) ?? DEFAULT_DELIVERY;
        if (sameDelivery(rows.get(kind) ?? DEFAULT_DELIVERY, wanted)) continue;

        await tx.notificationPreference.upsert({
          where: { userId_kind: { userId, kind } },
          create: { userId, kind, emailEnabled: wanted.email, pushEnabled: wanted.push },
          update: { emailEnabled: wanted.email, pushEnabled: wanted.push },
        });
      }

      const everyEmailOff = ALERT_KINDS.every((kind) => !after.get(kind)?.email);
      const mutedAt = everyEmailOff ? (stored.alertEmailsMutedAt ?? new Date()) : null;
      if (mutedAt !== stored.alertEmailsMutedAt) {
        await tx.user.update({ where: { id: userId }, data: { alertEmailsMutedAt: mutedAt } });
      }

      await this.auditService.track(tx, {
        actorUserId: options.actorUserId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.notification.preferencesUpdated,
        resourceType: AuditResourceType.user,
        resourceId: userId,
        before: pick(before, changedKinds),
        after: pick(after, changedKinds),
      });

      return toResponse(after);
    });
  }
}

const DEFAULT_DELIVERY: Delivery = { email: true, push: true };

function storedRows(stored: StoredPreferences): Map<string, Delivery> {
  return new Map(
    stored.notificationPreferences.map((row) => [
      row.kind,
      { email: row.emailEnabled, push: row.pushEnabled },
    ]),
  );
}

/** What each kind does now: the stored row or the default, with the mute applied to email. */
function effectiveDeliveries(stored: StoredPreferences): Map<AlertKind, Delivery> {
  const rows = storedRows(stored);
  const muted = stored.alertEmailsMutedAt !== null;

  return new Map(
    ALERT_KINDS.map((kind) => {
      const row = rows.get(kind) ?? DEFAULT_DELIVERY;
      return [kind, { email: row.email && !muted, push: row.push }];
    }),
  );
}

function sameDelivery(a: Delivery | undefined, b: Delivery | undefined): boolean {
  return a?.email === b?.email && a?.push === b?.push;
}

function pick(deliveries: Map<AlertKind, Delivery>, kinds: AlertKind[]) {
  return Object.fromEntries(kinds.map((kind) => [kind, deliveries.get(kind)]));
}

function toResponse(deliveries: Map<AlertKind, Delivery>): NotificationPreferences {
  return {
    preferences: ALERT_KINDS.map((kind) => ({
      kind,
      ...(deliveries.get(kind) ?? DEFAULT_DELIVERY),
    })),
  };
}

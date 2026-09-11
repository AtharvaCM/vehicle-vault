import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType } from '@prisma/client';

import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AlertEmailPreference = {
  muted: boolean;
  mutedAt: Date | null;
};

/**
 * Whether a user has silenced alert email, and the two ways that changes.
 *
 * Scoped to alert email on purpose. Verification, password reset, and invite
 * mail are transactional — each one answers something the recipient just did —
 * and muting here must never reach them. The in-app **Notification** row and
 * the push Channel are likewise untouched: this is a preference about a
 * delivery channel, not about whether the app is allowed to notice things.
 */
@Injectable()
export class AlertEmailPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async get(userId: string): Promise<AlertEmailPreference> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { alertEmailsMutedAt: true },
    });

    return toPreference(user?.alertEmailsMutedAt ?? null);
  }

  /**
   * `actorUserId` is null when this came from an unsubscribe link: the token
   * proves control of the mailbox, not of a session, and recording the user as
   * the actor would claim they were signed in when they were not.
   */
  async mute(
    userId: string,
    options: { actorUserId: string | null },
  ): Promise<AlertEmailPreference> {
    return this.set(userId, new Date(), AUDIT_ACTIONS.notification.alertEmailMuted, options);
  }

  async unmute(
    userId: string,
    options: { actorUserId: string | null },
  ): Promise<AlertEmailPreference> {
    return this.set(userId, null, AUDIT_ACTIONS.notification.alertEmailUnmuted, options);
  }

  private async set(
    userId: string,
    mutedAt: Date | null,
    action: string,
    options: { actorUserId: string | null },
  ): Promise<AlertEmailPreference> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId },
        select: { alertEmailsMutedAt: true },
      });

      // A signed token outlives the account it names — an unsubscribe link is
      // meant to still work in a year-old email. Say so plainly rather than
      // letting `update` throw P2025 at a person who clicked a link.
      if (!before) {
        throw new NotFoundException('That account no longer exists.');
      }

      // Already in the requested state: the row is left alone and no event is
      // written, so a mail client that fetches the one-click URL twice — or a
      // user who clicks an old link again — does not fill the trail with
      // changes that changed nothing.
      if (toPreference(before.alertEmailsMutedAt).muted === (mutedAt !== null)) {
        return toPreference(before.alertEmailsMutedAt);
      }

      const after = await tx.user.update({
        where: { id: userId },
        data: { alertEmailsMutedAt: mutedAt },
        select: { alertEmailsMutedAt: true },
      });

      await this.auditService.track(tx, {
        actorUserId: options.actorUserId,
        ownerUserId: userId,
        action,
        resourceType: AuditResourceType.user,
        resourceId: userId,
        before: { alertEmailsMutedAt: before.alertEmailsMutedAt },
        after: { alertEmailsMutedAt: after.alertEmailsMutedAt },
      });

      return toPreference(after.alertEmailsMutedAt);
    });
  }
}

function toPreference(mutedAt: Date | null): AlertEmailPreference {
  return { muted: mutedAt !== null, mutedAt };
}

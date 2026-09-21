import { Injectable } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { diffChangedFields, redact, redactAll } from './audit.redaction';

export type AuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type TrackInput = {
  actorUserId?: string | null;
  ownerUserId?: string | null;
  action: string;
  resourceType?: AuditResourceType | null;
  resourceId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  context?: AuditContext;
};

/**
 * Writes immutable AuditEvent rows. Always invoked inside the same
 * `prisma.$transaction` as the mutation it describes — see ADR-0004.
 *
 * Callers pass the transactional client `tx` so the audit insert is
 * atomic with the mutation. For auth events with no surrounding tx,
 * `tx` may be the regular PrismaService.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async track(tx: Prisma.TransactionClient | PrismaService, input: TrackInput): Promise<void> {
    const before = redact(input.resourceType ?? null, input.before ?? null);
    const after = redact(input.resourceType ?? null, input.after ?? null);
    const changedFields = diffChangedFields(before, after);

    await tx.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        ownerUserId: input.ownerUserId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        before: before as Prisma.InputJsonValue | undefined,
        after: after as Prisma.InputJsonValue | undefined,
        changedFields,
        ipAddress: input.context?.ipAddress ?? null,
        userAgent: input.context?.userAgent ?? null,
      },
    });
  }

  /**
   * Bulk anonymisation hook for account-deletion flows (ADR-0004): the rows
   * stay, with their timestamps, action, resource and changed fields, but
   * nothing in them says who the person was.
   *
   * - Rows about their own data (they are the owner): the owner link goes and
   *   every payload value is blanked — the write-time redaction keeps names and
   *   emails, which only matter while the account exists.
   * - Rows where they acted (they are the actor): the actor link goes, and so
   *   do the IP address and user agent, which describe them. Where the data
   *   belongs to someone else — an editor's change to a shared vehicle — the
   *   owner and the payload stay: that is the remaining owner's history.
   *
   * Pass `tx` to anonymise inside the transaction that deletes the account, so
   * the trail is never left pointing at, or describing, someone who is gone.
   */
  async anonymiseForUser(userId: string, tx?: Prisma.TransactionClient): Promise<void> {
    if (tx) {
      await this.anonymiseWithin(tx, userId);
      return;
    }

    await this.prisma.$transaction((client) => this.anonymiseWithin(client, userId));
  }

  private async anonymiseWithin(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const rows = await tx.auditEvent.findMany({
      where: {
        OR: [{ actorUserId: userId }, { ownerUserId: userId }],
      },
      select: { id: true, actorUserId: true, ownerUserId: true, before: true, after: true },
    });

    for (const row of rows) {
      const theirData = row.ownerUserId === userId;
      const theirAction = row.actorUserId === userId;

      await tx.auditEvent.update({
        where: { id: row.id },
        data: {
          ...(theirAction ? { actorUserId: null, ipAddress: null, userAgent: null } : {}),
          ...(theirData
            ? {
                ownerUserId: null,
                before: redactAll(row.before as Record<string, unknown> | null) as
                  | Prisma.InputJsonValue
                  | undefined,
                after: redactAll(row.after as Record<string, unknown> | null) as
                  | Prisma.InputJsonValue
                  | undefined,
              }
            : {}),
        },
      });
    }
  }
}

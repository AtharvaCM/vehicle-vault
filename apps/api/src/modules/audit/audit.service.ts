import { Injectable } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { diffChangedFields, redact } from './audit.redaction';

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

  async track(
    tx: Prisma.TransactionClient | PrismaService,
    input: TrackInput,
  ): Promise<void> {
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
   * Bulk anonymisation hook for account-deletion flows. Nulls out actor
   * and owner FKs and replaces PII fields in payloads with the redaction
   * sentinel while keeping timestamps, action, and resource id intact.
   * See ADR-0004.
   */
  async anonymiseForUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.auditEvent.findMany({
        where: {
          OR: [{ actorUserId: userId }, { ownerUserId: userId }],
        },
        select: { id: true, resourceType: true, before: true, after: true },
      });
      for (const row of rows) {
        const before = redact(
          row.resourceType,
          (row.before as Record<string, unknown> | null) ?? null,
        );
        const after = redact(
          row.resourceType,
          (row.after as Record<string, unknown> | null) ?? null,
        );
        await tx.auditEvent.update({
          where: { id: row.id },
          data: {
            actorUserId: null,
            ownerUserId: null,
            before: before as Prisma.InputJsonValue | undefined,
            after: after as Prisma.InputJsonValue | undefined,
          },
        });
      }
    });
  }
}

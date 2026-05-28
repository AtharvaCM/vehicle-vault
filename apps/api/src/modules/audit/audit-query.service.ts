import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AuditCursor = {
  occurredAt: string;
  id: string;
};

export type AuditQueryFilters = {
  resourceType?: AuditResourceType;
  action?: string;
  actionPrefix?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit?: number;
};

/**
 * Cursor-paginated AuditEvent reads. Two scopes:
 *
 * - `listForOwner(userId, filters)` returns events where the requesting
 *   user is either the actor or the resource owner.
 * - `listForVehicle(userId, vehicleId, filters)` returns events whose
 *   resource is the vehicle itself, plus events whose resource is owned
 *   by that vehicle (maintenance, reminders, documents, claims, fuel).
 *
 * The owner-scoping relies on the denormalised `ownerUserId` column, so
 * neither method needs a 7-way join. See ADR-0004.
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOwner(userId: string, filters: AuditQueryFilters) {
    const where: Prisma.AuditEventWhereInput = {
      OR: [{ ownerUserId: userId }, { actorUserId: userId }],
      ...this.commonFilters(filters),
    };
    return this.executeQuery(where, filters);
  }

  async listForVehicle(userId: string, vehicleId: string, filters: AuditQueryFilters) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // All descendant resource ids belonging to this vehicle.
    const [maintenance, reminders, insurance, warranties, claims, fuelLogs] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({ where: { vehicleId }, select: { id: true } }),
      this.prisma.reminder.findMany({ where: { vehicleId }, select: { id: true } }),
      this.prisma.insurancePolicy.findMany({ where: { vehicleId }, select: { id: true } }),
      this.prisma.warranty.findMany({ where: { vehicleId }, select: { id: true } }),
      this.prisma.claim.findMany({
        where: { insurancePolicy: { vehicleId } },
        select: { id: true },
      }),
      this.prisma.fuelLog.findMany({ where: { vehicleId }, select: { id: true } }),
    ]);

    const idsByType: [AuditResourceType, string[]][] = [
      [AuditResourceType.vehicle, [vehicleId]],
      [AuditResourceType.maintenance_record, maintenance.map((r) => r.id)],
      [AuditResourceType.reminder, reminders.map((r) => r.id)],
      [AuditResourceType.insurance_policy, insurance.map((r) => r.id)],
      [AuditResourceType.warranty, warranties.map((r) => r.id)],
      [AuditResourceType.claim, claims.map((r) => r.id)],
      [AuditResourceType.fuel_log, fuelLogs.map((r) => r.id)],
    ];

    const where: Prisma.AuditEventWhereInput = {
      ownerUserId: userId, // ownership gate even when ids are stale
      OR: idsByType
        .filter(([, ids]) => ids.length > 0)
        .map(([type, ids]) => ({ resourceType: type, resourceId: { in: ids } })),
      ...this.commonFilters(filters),
    };

    if (!Array.isArray(where.OR) || where.OR.length === 0) {
      // Vehicle has no resources yet — still allow vehicle.* events.
      where.OR = [{ resourceType: AuditResourceType.vehicle, resourceId: vehicleId }];
    }

    return this.executeQuery(where, filters);
  }

  private commonFilters(filters: AuditQueryFilters): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {};
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.action) where.action = filters.action;
    if (filters.actionPrefix) where.action = { startsWith: filters.actionPrefix };
    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return where;
  }

  private async executeQuery(where: Prisma.AuditEventWhereInput, filters: AuditQueryFilters) {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const cursor = filters.cursor ? this.decodeCursor(filters.cursor) : null;

    if (cursor) {
      // Keyset pagination: rows strictly older than the cursor (sorted desc).
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { occurredAt: { lt: cursor.occurredAt } },
            {
              occurredAt: cursor.occurredAt,
              id: { lt: cursor.id },
            },
          ],
        },
      ];
    }

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && events.length > 0
        ? this.encodeCursor({
            occurredAt: events[events.length - 1]!.occurredAt.toISOString(),
            id: events[events.length - 1]!.id,
          })
        : null;

    return {
      events,
      nextCursor,
    };
  }

  private encodeCursor(cursor: AuditCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(value: string): AuditCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (
        typeof parsed?.occurredAt !== 'string' ||
        typeof parsed?.id !== 'string'
      ) {
        throw new Error('Invalid cursor shape');
      }
      return { occurredAt: parsed.occurredAt, id: parsed.id };
    } catch {
      throw new ForbiddenException('Malformed cursor');
    }
  }
}

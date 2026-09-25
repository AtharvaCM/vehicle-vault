import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType, Prisma, type AuditEvent } from '@prisma/client';
import { SECURITY_AUDIT_PREFIXES } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export type AuditCursor = {
  occurredAt: string;
  id: string;
};

export const AUDIT_CATEGORIES = ['security', 'garage'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/**
 * An event as the activity feed reads it: who did it in words ("You", or
 * their name), and whether the record it is about still exists, so a
 * sentence links only to something that will open.
 */
export type AuditFeedEvent = AuditEvent & {
  actor: { name: string; isYou: boolean } | null;
  /** Null for events about no record, or a kind with nothing to open. */
  resourceExists: boolean | null;
};

export type AuditQueryFilters = {
  resourceType?: AuditResourceType;
  action?: string;
  actionPrefix?: string;
  category?: AuditCategory;
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
 *   by that vehicle (maintenance, reminders, documents, claims, fuel,
 *   tyres — inspection readings ride their tyre's resource id —
 *   and accessories).
 *
 * The owner-scoping relies on the denormalised `ownerUserId` column, so
 * neither method needs a 7-way join. See ADR-0004.
 */
type IdRows = Promise<{ id: string }[]>;
type Lookup = (prisma: PrismaService, ids: string[]) => IdRows;

/** The kinds of record a sentence can open, and how to tell which still exist. */
const RESOURCE_LOOKUP: Partial<Record<AuditResourceType, Lookup>> = {
  vehicle: (prisma, ids) =>
    prisma.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  maintenance_record: (prisma, ids) =>
    prisma.maintenanceRecord.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  reminder: (prisma, ids) =>
    prisma.reminder.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  fuel_log: (prisma, ids) =>
    prisma.fuelLog.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  vehicle_loan: (prisma, ids) =>
    prisma.vehicleLoan.findMany({ where: { id: { in: ids } }, select: { id: true } }),
};

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOwner(userId: string, filters: AuditQueryFilters) {
    const where: Prisma.AuditEventWhereInput = {
      OR: [{ ownerUserId: userId }, { actorUserId: userId }],
      ...this.commonFilters(filters),
    };
    return this.executeQuery(userId, where, filters);
  }

  async listForVehicle(userId: string, vehicleId: string, filters: AuditQueryFilters) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // All descendant resource ids belonging to this vehicle. Unfiltered by
    // status on purpose: the trail exists to show what happened to a row, and a
    // draft has a creation event, edits, and possibly a deletion like any other.
    // Hiding those would make the audit log lie about work that really occurred.
    const [maintenance, reminders, insurance, warranties, claims, fuelLogs, tyres, accessories] =
      await Promise.all([
        this.prisma.maintenanceRecord.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.reminder.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.insurancePolicy.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.warranty.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.claim.findMany({
          where: { insurancePolicy: { vehicleId } },
          select: { id: true },
        }),
        this.prisma.fuelLog.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.tyre.findMany({ where: { vehicleId }, select: { id: true } }),
        this.prisma.accessory.findMany({ where: { vehicleId }, select: { id: true } }),
      ]);

    const idsByType: [AuditResourceType, string[]][] = [
      [AuditResourceType.vehicle, [vehicleId]],
      [AuditResourceType.maintenance_record, maintenance.map((r) => r.id)],
      [AuditResourceType.reminder, reminders.map((r) => r.id)],
      [AuditResourceType.insurance_policy, insurance.map((r) => r.id)],
      [AuditResourceType.warranty, warranties.map((r) => r.id)],
      [AuditResourceType.claim, claims.map((r) => r.id)],
      [AuditResourceType.fuel_log, fuelLogs.map((r) => r.id)],
      [AuditResourceType.tyre, tyres.map((r) => r.id)],
      [AuditResourceType.accessory, accessories.map((r) => r.id)],
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

    return this.executeQuery(userId, where, filters);
  }

  private commonFilters(filters: AuditQueryFilters): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {};
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.action) where.action = filters.action;
    if (filters.actionPrefix) where.action = { startsWith: filters.actionPrefix };
    if (filters.category) {
      const security = SECURITY_AUDIT_PREFIXES.map((prefix) => ({
        action: { startsWith: prefix },
      }));
      where.AND = [filters.category === 'security' ? { OR: security } : { NOT: security }];
    }
    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return where;
  }

  private async executeQuery(
    userId: string,
    where: Prisma.AuditEventWhereInput,
    filters: AuditQueryFilters,
  ) {
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
      events: await this.describe(userId, events),
      nextCursor,
    };
  }

  /**
   * Adds the actor's name and whether each record still exists: two small
   * lookups per page (one per kind of record on it), not one per event.
   */
  private async describe(userId: string, events: AuditEvent[]): Promise<AuditFeedEvent[]> {
    const actorIds = [
      ...new Set(events.flatMap((event) => (event.actorUserId ? [event.actorUserId] : []))),
    ];
    const idsByType = new Map<AuditResourceType, Set<string>>();
    for (const event of events) {
      if (!event.resourceType || !event.resourceId || !(event.resourceType in RESOURCE_LOOKUP)) {
        continue;
      }
      const ids = idsByType.get(event.resourceType) ?? new Set<string>();
      ids.add(event.resourceId);
      idsByType.set(event.resourceType, ids);
    }

    const [actors, existing] = await Promise.all([
      actorIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          })
        : [],
      Promise.all(
        [...idsByType.entries()].map(async ([type, ids]) => {
          const found = await RESOURCE_LOOKUP[type]!(this.prisma, [...ids]);
          return found.map((row) => `${type}:${row.id}`);
        }),
      ),
    ]);
    const nameById = new Map(actors.map((actor) => [actor.id, actor.name]));
    const exists = new Set(existing.flat());

    return events.map((event) => ({
      ...event,
      actor: event.actorUserId
        ? {
            name: nameById.get(event.actorUserId) ?? 'Someone',
            isYou: event.actorUserId === userId,
          }
        : null,
      resourceExists:
        event.resourceType && event.resourceId && event.resourceType in RESOURCE_LOOKUP
          ? exists.has(`${event.resourceType}:${event.resourceId}`)
          : null,
    }));
  }

  private encodeCursor(cursor: AuditCursor): string {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
  }

  private decodeCursor(value: string): AuditCursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (typeof parsed?.occurredAt !== 'string' || typeof parsed?.id !== 'string') {
        throw new Error('Invalid cursor shape');
      }
      return { occurredAt: parsed.occurredAt, id: parsed.id };
    } catch {
      throw new ForbiddenException('Malformed cursor');
    }
  }
}

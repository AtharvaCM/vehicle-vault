import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditResourceType, Prisma } from '@prisma/client';
import {
  HISTORY_KINDS,
  HISTORY_PAGE_DEFAULT_LIMIT,
  MaintenanceCategory,
  MaintenanceRecordStatus,
  type HistoryEntry,
  type HistoryKind,
  type HistoryMonth,
  type HistoryPage,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import type { HistoryQueryDto } from './dto/history-query.dto';

/**
 * Dates are read on the Indian calendar wherever they are shown (the web's
 * format module fixes UTC+05:30), so a month here is an Indian month too: a
 * reading taken at 01:30 on 1 Oct in India is an October entry, though it is
 * still 30 Sep in UTC.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function historyMonth(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, monthNumber, 1) - IST_OFFSET_MS),
  };
}

type CursorKey = { at: Date; id: string };

export function encodeHistoryCursor(key: CursorKey): string {
  return Buffer.from(JSON.stringify({ t: key.at.toISOString(), id: key.id })).toString('base64url');
}

function decodeHistoryCursor(cursor: string): CursorKey {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && 't' in parsed && 'id' in parsed) {
      const at = new Date(String(parsed.t));
      const id = String(parsed.id);
      if (!Number.isNaN(at.getTime()) && /^[0-9a-f-]{36}$/.test(id)) {
        return { at, id };
      }
    }
  } catch {
    // Falls through to the refusal below.
  }
  throw new BadRequestException({ message: 'That page of history could not be read.' });
}

/**
 * Rows strictly after the cursor in the timeline's order (newest first, then
 * id descending). Ids are UUIDs across three tables, so (time, id) orders every
 * entry uniquely, and Postgres compares UUIDs byte by byte, the same order as
 * comparing their lower-case text.
 */
function after<TField extends string>(field: TField, cursor: CursorKey | null) {
  if (!cursor) return {};
  return {
    OR: [{ [field]: { lt: cursor.at } }, { [field]: cursor.at, id: { lt: cursor.id } }],
  };
}

function compareDesc(a: CursorKey, b: CursorKey): number {
  const byTime = b.at.getTime() - a.at.getTime();
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** A reading from an audit payload, when it holds a real one. */
function readingFrom(payload: Prisma.JsonValue | null): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const odometer = payload.odometer;
  return typeof odometer === 'number' && Number.isInteger(odometer) && odometer >= 0
    ? odometer
    : null;
}

type Candidate = { key: CursorKey; entry: HistoryEntry | null };

/**
 * The categories a search names. The web's labels are the enum values in
 * words ("engine_oil" is "Engine oil", "puc" is "PUC"), so matching the
 * words finds them without the API keeping a second copy of the labels.
 */
export function categoriesMatching(search: string): MaintenanceCategory[] {
  const words = search.toLowerCase().replace(/\s+/g, ' ');
  return Object.values(MaintenanceCategory).filter((category) =>
    category.replace(/_/g, ' ').includes(words),
  );
}

/**
 * A search's filters per table, each under its own `AND` so it spreads beside
 * the cursor's `OR`. Empty objects when there is no search.
 */
function searchFilters(search: string | undefined): {
  service: Prisma.MaintenanceRecordWhereInput;
  fuel: Prisma.FuelLogWhereInput;
  accessory: Prisma.AccessoryWhereInput;
} {
  if (!search) return { service: {}, fuel: {}, accessory: {} };
  const text = { contains: search, mode: 'insensitive' as const };
  const categories = categoriesMatching(search);

  return {
    service: {
      AND: [
        {
          OR: [
            { workshopName: text },
            { invoiceNumber: text },
            { notes: text },
            ...(categories.length > 0 ? [{ category: { in: categories } }] : []),
          ],
        },
      ],
    },
    fuel: { AND: [{ OR: [{ location: text }, { notes: text }] }] },
    accessory: {
      AND: [{ OR: [{ name: text }, { brand: text }, { category: text }, { notes: text }] }],
    },
  };
}

/**
 * The garage's timeline: what was done to each vehicle, newest first. Four
 * sources are merged — maintenance records (drafts included, marked by their
 * status), fuel fills, odometer readings, and accessories on the day they were
 * bought (#336). A reading has no table of its
 * own: every change to `Vehicle.odometer` through the vehicle's own paths
 * (the odometer update and the edit form) writes a `vehicle.updated` audit
 * event whose changed fields name the odometer, and that event is the entry.
 * Fills move the odometer without such an event, so a fill is never listed
 * twice.
 *
 * Pages are keyset-paginated over (time, id): each source is read for one row
 * more than the page, so the merged top of the four is exact and "more" is
 * known without counting.
 *
 * Month totals follow the draft invariant (see AnalyticsService): confirmed
 * service, fuel and accessory spend only, summed over the whole month under the same filters,
 * so a month split across two pages carries the same total on both.
 */
@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VehicleAccessService,
  ) {}

  async list(userId: string, query: HistoryQueryDto): Promise<HistoryPage> {
    const limit = query.limit ?? HISTORY_PAGE_DEFAULT_LIMIT;
    const cursor = query.cursor ? decodeHistoryCursor(query.cursor) : null;
    const requested: readonly HistoryKind[] = query.kind ? [query.kind] : HISTORY_KINDS;
    // A reading has no words to find, so a search leaves readings out.
    const kinds = query.search ? requested.filter((kind) => kind !== 'odometer') : requested;
    const matching = searchFilters(query.search);

    const accessible = await this.access.listAccessibleVehicleIds(userId);
    if (query.vehicleId && !accessible.includes(query.vehicleId)) {
      throw new NotFoundException(`Vehicle ${query.vehicleId} was not found`);
    }
    const vehicleIds = query.vehicleId ? [query.vehicleId] : accessible;
    if (vehicleIds.length === 0) {
      return {
        entries: [],
        months: [],
        draftCount: 0,
        firstDraftId: null,
        year: null,
        nextCursor: null,
      };
    }

    const take = limit + 1;
    const [services, fuels, readings, draftCount, accessories] = await Promise.all([
      kinds.includes('service')
        ? this.prisma.maintenanceRecord.findMany({
            where: {
              vehicleId: { in: vehicleIds },
              ...matching.service,
              ...after('serviceDate', cursor),
            },
            orderBy: [{ serviceDate: 'desc' }, { id: 'desc' }],
            take,
            select: {
              id: true,
              vehicleId: true,
              serviceDate: true,
              category: true,
              status: true,
              workshopName: true,
              odometer: true,
              totalCost: true,
              currencyCode: true,
            },
          })
        : [],
      kinds.includes('fuel')
        ? this.prisma.fuelLog.findMany({
            where: { vehicleId: { in: vehicleIds }, ...matching.fuel, ...after('date', cursor) },
            orderBy: [{ date: 'desc' }, { id: 'desc' }],
            take,
            select: {
              id: true,
              vehicleId: true,
              date: true,
              quantity: true,
              location: true,
              odometer: true,
              totalCost: true,
            },
          })
        : [],
      kinds.includes('odometer')
        ? this.prisma.auditEvent.findMany({
            where: {
              resourceType: AuditResourceType.vehicle,
              resourceId: { in: vehicleIds },
              action: AUDIT_ACTIONS.vehicle.updated,
              changedFields: { has: 'odometer' },
              ...after('occurredAt', cursor),
            },
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            take,
            select: { id: true, resourceId: true, occurredAt: true, before: true, after: true },
          })
        : [],
      kinds.includes('service')
        ? this.prisma.maintenanceRecord.count({
            where: { vehicleId: { in: vehicleIds }, status: MaintenanceRecordStatus.Draft },
          })
        : 0,
      kinds.includes('accessory')
        ? this.prisma.accessory.findMany({
            where: {
              vehicleId: { in: vehicleIds },
              ...matching.accessory,
              ...after('purchaseDate', cursor),
            },
            orderBy: [{ purchaseDate: 'desc' }, { id: 'desc' }],
            take,
            select: {
              id: true,
              vehicleId: true,
              purchaseDate: true,
              name: true,
              brand: true,
              cost: true,
              currencyCode: true,
              warrantyExpiresAt: true,
              attachments: {
                orderBy: { uploadedAt: 'desc' },
                take: 1,
                select: { id: true },
              },
            },
          })
        : [],
    ]);

    const candidates: Candidate[] = [
      ...services.map(
        (record): Candidate => ({
          key: { at: record.serviceDate, id: record.id },
          entry: {
            kind: 'service',
            id: record.id,
            vehicleId: record.vehicleId,
            occurredAt: record.serviceDate.toISOString(),
            month: historyMonth(record.serviceDate),
            category: record.category as MaintenanceCategory,
            status: record.status as MaintenanceRecordStatus,
            workshopName: record.workshopName?.trim() || null,
            odometer: record.odometer,
            totalCost: record.totalCost.toFixed(2),
            currencyCode: record.currencyCode,
          },
        }),
      ),
      ...fuels.map(
        (fill): Candidate => ({
          key: { at: fill.date, id: fill.id },
          entry: {
            kind: 'fuel',
            id: fill.id,
            vehicleId: fill.vehicleId,
            occurredAt: fill.date.toISOString(),
            month: historyMonth(fill.date),
            quantity: fill.quantity,
            location: fill.location?.trim() || null,
            odometer: fill.odometer,
            totalCost: fill.totalCost.toFixed(2),
          },
        }),
      ),
      ...accessories.map(
        (accessory): Candidate => ({
          key: { at: accessory.purchaseDate, id: accessory.id },
          entry: {
            kind: 'accessory',
            id: accessory.id,
            vehicleId: accessory.vehicleId,
            occurredAt: accessory.purchaseDate.toISOString(),
            month: historyMonth(accessory.purchaseDate),
            name: accessory.name,
            brand: accessory.brand?.trim() || null,
            cost: accessory.cost.toFixed(2),
            currencyCode: accessory.currencyCode,
            warrantyExpiresAt: accessory.warrantyExpiresAt?.toISOString() ?? null,
            receiptId: accessory.attachments[0]?.id ?? null,
          },
        }),
      ),
      ...readings.map((event): Candidate => {
        const odometer = readingFrom(event.after);
        return {
          key: { at: event.occurredAt, id: event.id },
          // A payload anonymised with a deleted account has no reading left. It
          // still takes its place in the order, so paging moves past it.
          entry:
            odometer === null || !event.resourceId
              ? null
              : {
                  kind: 'odometer',
                  id: event.id,
                  vehicleId: event.resourceId,
                  occurredAt: event.occurredAt.toISOString(),
                  month: historyMonth(event.occurredAt),
                  odometer,
                  previousOdometer: readingFrom(event.before),
                },
        };
      }),
    ];

    candidates.sort((a, b) => compareDesc(a.key, b.key));
    const page = candidates.slice(0, limit);
    const last = page.at(-1);
    const nextCursor = candidates.length > limit && last ? encodeHistoryCursor(last.key) : null;
    const entries = page.flatMap((candidate) => (candidate.entry ? [candidate.entry] : []));

    const [months, firstDraftId, year] = await Promise.all([
      this.summarizeMonths(entries, vehicleIds, kinds, matching),
      draftCount > 0 ? this.firstDraftId(vehicleIds) : null,
      // The year line sums up the garage, not the search: a search for a
      // station would otherwise read "No services logged this year".
      requested.includes('service') ? this.summarizeYear(vehicleIds, new Date()) : null,
    ]);

    return { entries, months, draftCount, firstDraftId, year, nextCursor };
  }

  /** The oldest draft on these vehicles: the one waiting longest to be confirmed. */
  private async firstDraftId(vehicleIds: string[]): Promise<string | null> {
    const draft = await this.prisma.maintenanceRecord.findFirst({
      where: { vehicleId: { in: vehicleIds }, status: MaintenanceRecordStatus.Draft },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    return draft?.id ?? null;
  }

  /**
   * This calendar year's confirmed services on these vehicles: how many, and
   * what they cost. Drafts never count (the draft invariant).
   */
  private async summarizeYear(vehicleIds: string[], now: Date) {
    const year = now.getUTCFullYear();
    const result = await this.prisma.maintenanceRecord.aggregate({
      where: {
        vehicleId: { in: vehicleIds },
        status: MaintenanceRecordStatus.Confirmed,
        serviceDate: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
      _count: { _all: true },
      _sum: { totalCost: true },
    });

    return {
      year,
      serviceCount: result._count._all,
      serviceSpend: (result._sum.totalCost ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  private async summarizeMonths(
    entries: HistoryEntry[],
    vehicleIds: string[],
    kinds: readonly HistoryKind[],
    matching: ReturnType<typeof searchFilters>,
  ): Promise<HistoryMonth[]> {
    const months = [...new Set(entries.map((entry) => entry.month))];
    if (months.length === 0) return [];

    const newest = monthBounds(months[0]!);
    const oldest = monthBounds(months.at(-1)!);
    const range = { gte: oldest.start, lt: newest.end };

    const [services, fuels, accessories] = await Promise.all([
      kinds.includes('service')
        ? this.prisma.maintenanceRecord.findMany({
            where: { vehicleId: { in: vehicleIds }, serviceDate: range, ...matching.service },
            select: { serviceDate: true, totalCost: true, status: true },
          })
        : [],
      kinds.includes('fuel')
        ? this.prisma.fuelLog.findMany({
            where: { vehicleId: { in: vehicleIds }, date: range, ...matching.fuel },
            select: { date: true, totalCost: true },
          })
        : [],
      kinds.includes('accessory')
        ? this.prisma.accessory.findMany({
            where: { vehicleId: { in: vehicleIds }, purchaseDate: range, ...matching.accessory },
            select: { purchaseDate: true, cost: true },
          })
        : [],
    ]);

    const byMonth = new Map<string, { total: Prisma.Decimal | null; draftCount: number }>(
      months.map((month) => [month, { total: null, draftCount: 0 }]),
    );
    const add = (date: Date, amount: Prisma.Decimal) => {
      const bucket = byMonth.get(historyMonth(date));
      if (bucket) bucket.total = (bucket.total ?? new Prisma.Decimal(0)).plus(amount);
    };

    for (const record of services) {
      if (record.status === MaintenanceRecordStatus.Draft) {
        const bucket = byMonth.get(historyMonth(record.serviceDate));
        if (bucket) bucket.draftCount += 1;
      } else {
        add(record.serviceDate, record.totalCost);
      }
    }
    for (const fill of fuels) add(fill.date, fill.totalCost);
    for (const accessory of accessories) add(accessory.purchaseDate, accessory.cost);

    return months.map((month) => {
      const bucket = byMonth.get(month)!;
      return {
        month,
        total: bucket.total ? bucket.total.toFixed(2) : null,
        draftCount: bucket.draftCount,
      };
    });
  }
}

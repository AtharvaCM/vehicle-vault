import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The events this app records about itself. Each marks a step someone takes on
 * the way from stranger to regular user — enough to see where people stop.
 */
export const PRODUCT_EVENT_NAMES = [
  'account_created',
  'email_verified',
  'vehicle_created',
  'first_maintenance_logged',
  'first_fuel_logged',
  'reminder_created',
  'notification_opened',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

/** Recorded once per user, ever — see `recordFirst`. */
type FirstEventName = 'first_maintenance_logged' | 'first_fuel_logged';

/**
 * Flat, non-personal values only: a method, a kind, a flag. Never an email, a
 * name, a registration or policy number — the type keeps nested objects out, and
 * the rest is on whoever adds a property.
 */
type EventProperties = Record<string, string | number | boolean>;

/** A transaction client when one exists, otherwise the plain client. */
type Client = Prisma.TransactionClient | PrismaService;

export type ProductEventSummary = {
  days: number;
  /** First and last day covered, `YYYY-MM-DD`, UTC. */
  from: string;
  to: string;
  totals: Record<ProductEventName, number>;
  /** One entry per day in the window, oldest first, with zeros filled in. */
  series: { date: string; counts: Record<ProductEventName, number> }[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Append-only product telemetry, written server-side next to the audit event of
 * the same action — inside its transaction when there is one — so an event can
 * never describe something that was rolled back.
 *
 * Both writers return the Prisma promise rather than awaiting it, so they can
 * join an interactive transaction (`await`) or a batch one (in the array).
 */
@Injectable()
export class ProductEventsService {
  constructor(private readonly prisma: PrismaService) {}

  record(
    client: Client,
    event: {
      name: Exclude<ProductEventName, FirstEventName>;
      userId: string | null;
      vehicleId?: string | null;
      properties?: EventProperties;
    },
  ) {
    return client.productEvent.create({
      data: {
        name: event.name,
        userId: event.userId,
        vehicleId: event.vehicleId ?? null,
        properties: event.properties ?? {},
      },
    });
  }

  /**
   * A first-ever event, which a user can only have one of — even after deleting
   * the record that earned it. The partial unique index on (userId, name) is the
   * guard, so two concurrent saves cannot both count; `skipDuplicates` is
   * `ON CONFLICT DO NOTHING`, because a plain insert tripping that index would
   * abort the transaction and lose the record the user was saving.
   */
  recordFirst(
    client: Client,
    event: { name: FirstEventName; userId: string; vehicleId?: string | null },
  ) {
    return client.productEvent.createMany({
      data: [
        {
          name: event.name,
          userId: event.userId,
          vehicleId: event.vehicleId ?? null,
          properties: {},
        },
      ],
      skipDuplicates: true,
    });
  }

  /** Per-day counts of every event over the last `days` days, today included. UTC days. */
  async summary(days: number, now = new Date()): Promise<ProductEventSummary> {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const from = new Date(today - (days - 1) * MS_PER_DAY);

    const rows = await this.prisma.$queryRaw<{ day: Date; name: string; count: number }[]>`
      SELECT date_trunc('day', "occurredAt")::date AS day, "name", count(*)::int AS count
      FROM "ProductEvent"
      WHERE "occurredAt" >= ${from}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `;

    const zeroes = () =>
      Object.fromEntries(PRODUCT_EVENT_NAMES.map((name) => [name, 0])) as Record<
        ProductEventName,
        number
      >;
    const series = Array.from({ length: days }, (_, index) => ({
      date: isoDay(new Date(from.getTime() + index * MS_PER_DAY)),
      counts: zeroes(),
    }));
    const byDate = new Map(series.map((entry) => [entry.date, entry.counts]));
    const totals = zeroes();

    for (const row of rows) {
      const counts = byDate.get(isoDay(row.day));
      // An event name this build does not know about is someone else's to count.
      if (!counts || !(row.name in counts)) continue;
      counts[row.name as ProductEventName] += row.count;
      totals[row.name as ProductEventName] += row.count;
    }

    return { days, from: isoDay(from), to: isoDay(new Date(today)), totals, series };
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

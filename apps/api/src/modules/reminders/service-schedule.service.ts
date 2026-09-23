import { AuditResourceType, Prisma, ReminderType as PrismaReminderType } from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { FuelType, ReminderStatus, VehicleType } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { ProductEventsService } from '../product-events/product-events.service';
import {
  MaintenanceIntervalResolver,
  type IntervalVehicleShape,
} from '../vehicles/maintenance-interval.resolver';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import { TyresService } from '../tyres/tyres.service';
import { composeCatalogNotes, extractSlugFromNotes, TYRE_INSPECTION_SLUG } from './catalog-marker';
import { filterCatalogForVehicle, type ServiceScheduleItem } from './service-schedule-catalog';

/**
 * Where a proposed interval is counted from. For most catalog items that is
 * simply "now, at the current odometer"; for the tyre walk-around it is the
 * last time anyone actually looked, so scheduling a check four thousand
 * kilometres after the last one proposes it in one thousand rather than five.
 */
interface ScheduleAnchor {
  odometer: number;
  at: Date;
}

export interface ServiceScheduleSuggestion {
  slug: string;
  type: ServiceScheduleItem['type'];
  title: string;
  notes?: string;
  intervalKm?: number;
  intervalMonths?: number;
  /** Computed proposed `dueOdometer` (current odo + intervalKm). */
  dueOdometer?: number;
  /** Computed proposed `dueDate` (today + intervalMonths) as ISO. */
  dueDate?: string;
  /** True if a non-completed reminder with the same catalog slug or title is already scheduled. */
  alreadyScheduled: boolean;
}

/**
 * Surfaces generic recommended service intervals as draft reminders the
 * user can apply with one click. Source-of-truth catalog lives in
 * `service-schedule-catalog.ts`. Suggestions are filtered by the
 * vehicle's `fuelType` / `vehicleType` so EV owners don't see oil-change
 * recommendations.
 */
@Injectable()
export class ServiceScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly auditService: AuditService,
    private readonly access: VehicleAccessService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
    private readonly tyresService: TyresService,
    private readonly productEvents: ProductEventsService,
  ) {}

  async getSuggestions(userId: string, vehicleId: string): Promise<ServiceScheduleSuggestion[]> {
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const items = await this.itemsForVehicle(vehicle);
    const existing = await this.prisma.reminder.findMany({
      where: {
        vehicleId,
        status: { not: ReminderStatus.Completed },
      },
      select: { title: true, notes: true },
    });
    const existingKeys = new Set<string>();
    for (const reminder of existing) {
      existingKeys.add(reminder.title.trim().toLowerCase());
      const slug = extractSlugFromNotes(reminder.notes);
      if (slug) existingKeys.add(`slug:${slug}`);
    }

    const now = new Date();
    const fallback: ScheduleAnchor = { odometer: vehicle.odometer, at: now };
    const anchors = await this.resolveAnchors(userId, vehicleId, vehicle.odometer, now);

    return items.map((item) => this.toSuggestion(item, anchors, fallback, existingKeys));
  }

  async applySuggestions(userId: string, vehicleId: string, slugs: string[]) {
    await this.access.assertEditor(userId, vehicleId);
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const unique = Array.from(new Set(slugs));
    const items = (await this.itemsForVehicle(vehicle)).filter((item) =>
      unique.includes(item.slug),
    );

    const unknown = unique.filter((slug) => !items.some((item) => item.slug === slug));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown or non-applicable service-schedule slugs: ${unknown.join(', ')}`,
      );
    }
    if (items.length === 0) {
      return { created: [] as string[] };
    }

    const now = new Date();
    const created: string[] = [];
    // The same anchors the suggestion was previewed against, so applying one
    // creates the reminder the user was shown rather than a later one.
    const anchors = await this.resolveAnchors(userId, vehicleId, vehicle.odometer, now);

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const anchor = anchors[item.slug] ?? { odometer: vehicle.odometer, at: now };
        const dueOdometer = item.intervalKm != null ? anchor.odometer + item.intervalKm : null;
        const dueDate =
          item.intervalMonths != null ? addMonths(anchor.at, item.intervalMonths) : null;
        if (dueOdometer == null && dueDate == null) continue;

        const reminder = await tx.reminder.create({
          data: {
            vehicleId,
            title: item.title,
            type: item.type as unknown as PrismaReminderType,
            dueOdometer,
            dueDate,
            notes: composeCatalogNotes(item.slug, item.notes),
            status: ReminderStatus.Upcoming,
          },
        });
        await this.auditService.track(tx, {
          actorUserId: userId,
          ownerUserId: userId,
          action: AUDIT_ACTIONS.reminder.created,
          resourceType: AuditResourceType.reminder,
          resourceId: reminder.id,
          after: reminder as unknown as Record<string, unknown>,
        });
        // Counted per reminder the user chose to apply. A successor rolled forward on
        // completion (`buildNextOccurrence`) is the app's doing, not theirs, and is not.
        await this.productEvents.record(tx, {
          name: 'reminder_created',
          userId,
          vehicleId,
          properties: { source: 'schedule' },
        });
        created.push(reminder.id);
      }
    });

    return { created };
  }

  /**
   * The next occurrence of a catalog-derived reminder, or null when there is
   * nothing to schedule.
   *
   * This is what makes an interval a cadence rather than a one-off: a catalog
   * item says "every 10 000 km", and until now completing one produced nothing,
   * so the schedule quietly stopped the first time someone acted on it. Only
   * reminders carrying a catalog marker recur — a hand-written reminder states
   * no interval and is not silently turned into a repeating one.
   */
  async buildNextOccurrence(
    userId: string,
    vehicleId: string,
    slug: string | null,
    now: Date,
    /**
     * The reminder this one succeeds, when called from completion. It is still
     * active at this point — completion has not been committed yet — so without
     * excluding it the duplicate check below sees the reminder as its own
     * successor and nothing is ever scheduled.
     */
    excludeReminderId?: string,
  ): Promise<Prisma.ReminderUncheckedCreateInput | null> {
    if (!slug) return null;

    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const item = (await this.itemsForVehicle(vehicle)).find((candidate) => candidate.slug === slug);
    // Gone from the catalog, or no longer applicable to this vehicle (an engine
    // swapped to electric). Either way there is no interval to trust.
    if (!item) return null;
    if (item.intervalKm == null && item.intervalMonths == null) return null;

    // Something already covers this slug — a second row would double the nagging
    // without doubling the information. The marker lives in free text, so this
    // cannot be a WHERE clause and every active row has to be read.
    const active = await this.prisma.reminder.findMany({
      where: {
        vehicleId,
        status: { not: ReminderStatus.Completed },
        ...(excludeReminderId ? { id: { not: excludeReminderId } } : {}),
      },
      select: { notes: true },
    });
    if (active.some((reminder) => extractSlugFromNotes(reminder.notes) === slug)) return null;

    const anchors = await this.resolveAnchors(userId, vehicleId, vehicle.odometer, now);
    const anchor = anchors[slug] ?? { odometer: vehicle.odometer, at: now };

    const dueOdometer = item.intervalKm != null ? anchor.odometer + item.intervalKm : null;
    const dueDate = item.intervalMonths != null ? addMonths(anchor.at, item.intervalMonths) : null;

    // A successor born already due repeats what the row just completed said,
    // and completing that one would produce another — a treadmill of reminders
    // rather than a schedule. It happens when the anchor has not moved on: the
    // walk-around was ticked off without a measurement being logged, so "the
    // last time anyone looked" is still where it was. The honest answer is no
    // new row; `tyre-uninspected` already says the tyres have not been measured.
    const odometerReached = dueOdometer == null || dueOdometer <= vehicle.odometer;
    const dateReached = dueDate == null || dueDate.getTime() <= now.getTime();
    if (odometerReached && dateReached) return null;

    return {
      vehicleId,
      title: item.title,
      type: item.type as unknown as PrismaReminderType,
      dueOdometer,
      dueDate,
      notes: composeCatalogNotes(item.slug, item.notes),
      status: ReminderStatus.Upcoming,
    };
  }

  /**
   * Catalog items for this vehicle, with generic intervals replaced by
   * per-variant `ServiceInterval` data when the vehicle is linked to a
   * catalog variant. Curated defaults stay untouched otherwise.
   *
   * The curated catalog is written for cars, so a two-wheeler takes every
   * interval from the resolver's two-wheeler table instead, and loses any item
   * the resolver says does not apply to it — tyre rotation always, chain and
   * coolant unless its spec says chain drive or liquid cooling.
   */
  private async itemsForVehicle(
    vehicle: IntervalVehicleShape & { fuelType: string; vehicleType: string },
  ): Promise<ServiceScheduleItem[]> {
    const items = filterCatalogForVehicle(
      vehicle.fuelType as FuelType,
      vehicle.vehicleType as VehicleType,
    );
    const twoWheeler = vehicle.vehicleType === VehicleType.Motorcycle;
    if (!vehicle.catalogVariantId && !twoWheeler) return items;

    const intervals = await this.intervalResolver.resolveForVehicle(vehicle);
    return items.flatMap((item) => {
      if (!item.category) return [item];
      const resolved = intervals[item.category];
      if (!resolved) return twoWheeler ? [] : [item];
      if (resolved.source !== 'variant' && !twoWheeler) return [item];
      return [
        {
          ...item,
          intervalKm: resolved.km ?? item.intervalKm,
          intervalMonths: resolved.months ?? item.intervalMonths,
        },
      ];
    });
  }

  /**
   * Per-slug anchors, for the items whose interval should be counted from
   * something the app already knows rather than from the moment the user opened
   * the screen.
   *
   * Only the tyre walk-around has one today. The same argument applies to every
   * category with a **ServiceBaseline** or a logged service behind it, and
   * generalising it is the obvious next step — but each anchor needs its own
   * source, so they are added one at a time rather than guessed at wholesale.
   */
  private async resolveAnchors(
    userId: string,
    vehicleId: string,
    currentOdometer: number,
    now: Date,
  ): Promise<Record<string, ScheduleAnchor>> {
    const tyreState = await this.tyresService.getAlertState(userId, vehicleId);
    const observation = tyreState.lastObservation;
    if (!observation) return {};

    // A future-dated or ahead-of-odometer observation would push the next check
    // further out than the interval allows, so the anchor never runs ahead of now.
    return {
      [TYRE_INSPECTION_SLUG]: {
        odometer: Math.min(observation.odometer, currentOdometer),
        at: observation.at.getTime() > now.getTime() ? now : observation.at,
      },
    };
  }

  private toSuggestion(
    item: ServiceScheduleItem,
    anchors: Record<string, ScheduleAnchor>,
    fallback: ScheduleAnchor,
    existingKeys: Set<string>,
  ): ServiceScheduleSuggestion {
    const alreadyScheduled =
      existingKeys.has(item.title.trim().toLowerCase()) || existingKeys.has(`slug:${item.slug}`);
    const anchor = anchors[item.slug] ?? fallback;
    return {
      slug: item.slug,
      type: item.type,
      title: item.title,
      notes: item.notes,
      intervalKm: item.intervalKm,
      intervalMonths: item.intervalMonths,
      dueOdometer: item.intervalKm != null ? anchor.odometer + item.intervalKm : undefined,
      dueDate:
        item.intervalMonths != null
          ? addMonths(anchor.at, item.intervalMonths).toISOString()
          : undefined,
      alreadyScheduled,
    };
  }
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

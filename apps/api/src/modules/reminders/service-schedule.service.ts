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
import { addMonths, nextOccurrenceDue } from './repeat-rule';
import {
  filterCatalogForVehicle,
  TYRE_INSPECTION_SLUG,
  type ServiceScheduleItem,
} from './service-schedule-catalog';

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

/** What completion knows about the reminder whose successor is being built. */
export type CompletedReminder = Pick<
  Prisma.ReminderUncheckedCreateInput,
  'title' | 'type' | 'notes'
> & {
  id: string;
  vehicleId: string;
  dueDate: Date | null;
  catalogSlug: string | null;
  repeatEveryMonths: number | null;
  repeatEveryKm: number | null;
};

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
      select: { title: true, catalogSlug: true },
    });
    const existingKeys = new Set<string>();
    for (const reminder of existing) {
      existingKeys.add(reminder.title.trim().toLowerCase());
      if (reminder.catalogSlug) existingKeys.add(`slug:${reminder.catalogSlug}`);
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
            notes: item.notes ?? null,
            // Its origin, and the cadence it follows from here on: the reminder
            // form shows and edits the rule like any other.
            catalogSlug: item.slug,
            repeatEveryKm: item.intervalKm ?? null,
            repeatEveryMonths: item.intervalMonths ?? null,
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
   * The next occurrence of a completed reminder, or null when there is nothing
   * to schedule.
   *
   * The reminder's own repeat rule decides: a hand-written one repeats when its
   * owner chose a rule on the form, and one made from this schedule carries the
   * item's interval from the moment it is applied (see `applySuggestions`), so
   * it keeps its cadence however many times it is completed. A reminder with no
   * rule does not repeat.
   *
   * A schedule reminder also keeps what made it schedule-aware: nothing when
   * its item no longer applies to the vehicle (an engine swapped to electric),
   * nothing when another open reminder already covers the item. Completing
   * one is the owner saying it was done now, so the next is counted from now,
   * except for the tyre walk-around: ticking it off is not a measurement, so it
   * keeps counting from the last tyre reading.
   */
  async buildNextOccurrence(
    userId: string,
    completed: CompletedReminder,
    now: Date,
  ): Promise<Prisma.ReminderUncheckedCreateInput | null> {
    const rule = { everyMonths: completed.repeatEveryMonths, everyKm: completed.repeatEveryKm };
    if (rule.everyMonths == null && rule.everyKm == null) return null;

    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, completed.vehicleId);
    let anchor: ScheduleAnchor = { odometer: vehicle.odometer, at: now };

    if (completed.catalogSlug) {
      const slug = completed.catalogSlug;
      const item = (await this.itemsForVehicle(vehicle)).find(
        (candidate) => candidate.slug === slug,
      );
      if (!item) return null;

      // Something already covers this item: a second row would double the
      // nagging without doubling the information. The completed reminder is
      // still open at this point (completion has not been committed yet), so
      // it is excluded or it would count as its own successor.
      const covering = await this.prisma.reminder.count({
        where: {
          vehicleId: completed.vehicleId,
          catalogSlug: slug,
          status: { not: ReminderStatus.Completed },
          id: { not: completed.id },
        },
      });
      if (covering > 0) return null;

      if (slug === TYRE_INSPECTION_SLUG) {
        const anchors = await this.resolveAnchors(
          userId,
          completed.vehicleId,
          vehicle.odometer,
          now,
        );
        anchor = anchors[slug] ?? anchor;
      }
    }

    // Born already due, when the anchor has not moved on (the walk-around was
    // ticked off without a reading), comes back null: `tyre-uninspected`
    // already says the tyres have not been measured.
    const due = nextOccurrenceDue({
      rule,
      type: completed.type as unknown as ServiceScheduleItem['type'],
      previousDueDate: completed.dueDate,
      anchor,
      now,
      currentOdometer: vehicle.odometer,
    });
    if (!due) return null;

    return {
      vehicleId: completed.vehicleId,
      title: completed.title,
      type: completed.type,
      notes: completed.notes ?? null,
      dueOdometer: due.dueOdometer,
      dueDate: due.dueDate,
      catalogSlug: completed.catalogSlug,
      repeatEveryMonths: completed.repeatEveryMonths,
      repeatEveryKm: completed.repeatEveryKm,
      status: ReminderStatus.Upcoming,
    };
  }

  /**
   * Catalog items for this vehicle, with generic intervals replaced by
   * per-variant `ServiceInterval` data when the vehicle is linked to a
   * catalog variant. Curated defaults stay untouched otherwise.
   */
  private async itemsForVehicle(
    vehicle: IntervalVehicleShape & { fuelType: string; vehicleType: string },
  ): Promise<ServiceScheduleItem[]> {
    const items = filterCatalogForVehicle(
      vehicle.fuelType as FuelType,
      vehicle.vehicleType as VehicleType,
    );
    if (!vehicle.catalogVariantId) return items;

    const intervals = await this.intervalResolver.resolveForVehicle(vehicle);
    return items.map((item) => {
      if (!item.category) return item;
      const resolved = intervals[item.category];
      if (!resolved || resolved.source !== 'variant') return item;
      return {
        ...item,
        intervalKm: resolved.km ?? item.intervalKm,
        intervalMonths: resolved.months ?? item.intervalMonths,
      };
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

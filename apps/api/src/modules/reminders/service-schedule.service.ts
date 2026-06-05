import { AuditResourceType, ReminderType as PrismaReminderType } from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { FuelType, ReminderStatus, VehicleType } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { AuditService } from '../audit/audit.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import {
  filterCatalogForVehicle,
  type ServiceScheduleItem,
} from './service-schedule-catalog';

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
  ) {}

  async getSuggestions(userId: string, vehicleId: string): Promise<ServiceScheduleSuggestion[]> {
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const items = filterCatalogForVehicle(
      vehicle.fuelType as FuelType,
      vehicle.vehicleType as VehicleType,
    );
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

    return items.map((item) => this.toSuggestion(item, vehicle.odometer, existingKeys));
  }

  async applySuggestions(userId: string, vehicleId: string, slugs: string[]) {
    await this.access.assertEditor(userId, vehicleId);
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const unique = Array.from(new Set(slugs));
    const items = filterCatalogForVehicle(
      vehicle.fuelType as FuelType,
      vehicle.vehicleType as VehicleType,
    ).filter((item) => unique.includes(item.slug));

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

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const dueOdometer =
          item.intervalKm != null ? vehicle.odometer + item.intervalKm : null;
        const dueDate =
          item.intervalMonths != null ? addMonths(now, item.intervalMonths) : null;
        if (dueOdometer == null && dueDate == null) continue;

        const reminder = await tx.reminder.create({
          data: {
            vehicleId,
            title: item.title,
            type: item.type as unknown as PrismaReminderType,
            dueOdometer,
            dueDate,
            notes: composeNotes(item),
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
        created.push(reminder.id);
      }
    });

    return { created };
  }

  private toSuggestion(
    item: ServiceScheduleItem,
    currentOdometer: number,
    existingKeys: Set<string>,
  ): ServiceScheduleSuggestion {
    const alreadyScheduled =
      existingKeys.has(item.title.trim().toLowerCase()) ||
      existingKeys.has(`slug:${item.slug}`);
    return {
      slug: item.slug,
      type: item.type,
      title: item.title,
      notes: item.notes,
      intervalKm: item.intervalKm,
      intervalMonths: item.intervalMonths,
      dueOdometer:
        item.intervalKm != null ? currentOdometer + item.intervalKm : undefined,
      dueDate:
        item.intervalMonths != null
          ? addMonths(new Date(), item.intervalMonths).toISOString()
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

const SLUG_MARKER = '[catalog:';

function composeNotes(item: ServiceScheduleItem): string {
  const marker = `${SLUG_MARKER}${item.slug}]`;
  return item.notes ? `${item.notes}\n${marker}` : marker;
}

function extractSlugFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const idx = notes.indexOf(SLUG_MARKER);
  if (idx === -1) return null;
  const end = notes.indexOf(']', idx);
  if (end === -1) return null;
  return notes.slice(idx + SLUG_MARKER.length, end);
}

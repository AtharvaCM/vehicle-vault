import {
  AuditResourceType,
  MaintenanceRecordStatus,
  Prisma,
  ReminderStatus,
  ReminderType,
  type MaintenanceCategory,
} from '@prisma/client';

import type { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { computeReminderStatus } from '../reminders/reminder-status';

/** The fields of a service record a next-due reminder is made from. */
export type NextDueSource = {
  id: string;
  vehicleId: string;
  category: MaintenanceCategory;
  serviceDate: Date;
  workshopName: string | null;
  status: MaintenanceRecordStatus;
  nextDueDate: Date | null;
  nextDueOdometer: number | null;
};

/** Categories whose reminder has a type of its own; everything else is a service. */
const REMINDER_TYPE_FOR: Partial<Record<MaintenanceCategory, ReminderType>> = {
  tyre_rotation: ReminderType.tyre_rotation,
  battery: ReminderType.battery,
  puc: ReminderType.puc,
  insurance: ReminderType.insurance,
};

/** "Periodic service due", "Engine oil due": the work, then that it is due. */
export function nextDueTitle(category: MaintenanceCategory): string {
  if (category === 'other') return 'Service due';
  const words = category.replace(/_/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} due`;
}

/** Says where the date came from, so the reminder reads as the workshop's, not the app's. */
export function nextDueNotes(source: Pick<NextDueSource, 'serviceDate' | 'workshopName'>): string {
  const on = source.serviceDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return source.workshopName
    ? `Set at the service at ${source.workshopName} on ${on}.`
    : `Set at the service on ${on}.`;
}

/**
 * Turns what the workshop wrote down, when to come back, into a reminder, once
 * the record is confirmed. The record keeps one reminder: confirming or editing
 * it again refreshes that reminder instead of adding a second, and a reminder
 * the user has already completed is left alone. A record with neither field
 * changes nothing.
 *
 * A confirmed service also fulfils the reminders earlier services of the same
 * kind left on the vehicle: the oil change they asked for has happened. Only
 * reminders made from records are closed this way, never one someone set by
 * hand. Every write is audited in the caller's transaction, like any other
 * reminder write.
 */
export async function syncNextDueReminder(
  tx: Prisma.TransactionClient,
  auditService: AuditService,
  actorUserId: string,
  source: NextDueSource,
): Promise<void> {
  if (source.status !== MaintenanceRecordStatus.confirmed) return;
  if (!source.nextDueDate && source.nextDueOdometer == null) return;

  const vehicle = await tx.vehicle.findUnique({
    where: { id: source.vehicleId },
    select: { odometer: true, userId: true },
  });
  if (!vehicle) return;

  const fields = {
    title: nextDueTitle(source.category),
    type: REMINDER_TYPE_FOR[source.category] ?? ReminderType.service,
    dueDate: source.nextDueDate,
    dueOdometer: source.nextDueOdometer,
    notes: nextDueNotes(source),
  };
  const status = computeReminderStatus(
    {
      dueDate: source.nextDueDate?.toISOString(),
      dueOdometer: source.nextDueOdometer ?? undefined,
    },
    vehicle.odometer,
  ) as ReminderStatus;

  const existing = await tx.reminder.findUnique({
    where: { sourceMaintenanceRecordId: source.id },
  });

  let reminderId: string;
  if (existing) {
    reminderId = existing.id;
    if (!existing.completedAt) {
      const updated = await tx.reminder.update({
        where: { id: existing.id },
        data: { ...fields, status },
      });
      await auditService.track(tx, {
        actorUserId,
        ownerUserId: vehicle.userId,
        action: AUDIT_ACTIONS.reminder.updated,
        resourceType: AuditResourceType.reminder,
        resourceId: existing.id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
    }
  } else {
    const created = await tx.reminder.create({
      data: {
        ...fields,
        vehicleId: source.vehicleId,
        sourceMaintenanceRecordId: source.id,
        status,
      },
    });
    reminderId = created.id;
    await auditService.track(tx, {
      actorUserId,
      ownerUserId: vehicle.userId,
      action: AUDIT_ACTIONS.reminder.created,
      resourceType: AuditResourceType.reminder,
      resourceId: created.id,
      after: created as unknown as Record<string, unknown>,
    });
  }

  const fulfilled = await tx.reminder.findMany({
    where: {
      vehicleId: source.vehicleId,
      id: { not: reminderId },
      completedAt: null,
      sourceMaintenanceRecord: {
        category: source.category,
        serviceDate: { lt: source.serviceDate },
      },
    },
  });
  const now = new Date();
  for (const reminder of fulfilled) {
    const completed = await tx.reminder.update({
      where: { id: reminder.id },
      data: { completedAt: now, status: ReminderStatus.completed },
    });
    await auditService.track(tx, {
      actorUserId,
      ownerUserId: vehicle.userId,
      action: AUDIT_ACTIONS.reminder.completed,
      resourceType: AuditResourceType.reminder,
      resourceId: reminder.id,
      before: reminder as unknown as Record<string, unknown>,
      after: completed as unknown as Record<string, unknown>,
    });
  }
}

import { AuditResourceType, Prisma, ReminderType as PrismaReminderType } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ReminderCreateSchema,
  ReminderSnoozeSchema,
  ReminderStatus,
  ReminderType,
  ReminderUpdateSchema,
  reminderSnoozeTarget,
  type Reminder,
  type ReminderSnoozeInput,
  type UpdateReminderInput,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProductEventsService } from '../product-events/product-events.service';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import { NotificationsService } from '../notifications/notifications.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleAccessService } from '../vehicles/vehicle-access.service';
import type { CreateReminderDto } from './dto/create-reminder.dto';
import type { ListRemindersQueryDto } from './dto/list-reminders-query.dto';
import type { UpdateReminderDto } from './dto/update-reminder.dto';
import { ServiceScheduleService } from './service-schedule.service';
import { computeUsageCadence, projectDueDate, type UsageCadence } from './usage-projection';
import { computeReminderStatus, reminderStatusPriority } from './reminder-status';
import { linkRenewalReminder, linkedPaperId, renewalKindOf } from './renewal-link';
import { reminderLogCategory } from './log-category';
import type { RepeatAnchor } from './repeat-rule';

const USAGE_PROJECTION_FUEL_LOG_WINDOW_DAYS = 180;

function utcDayOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** What a reminder is read with: the odometer its status counts from, and the paper it may follow. */
const REMINDER_INCLUDE = {
  vehicle: { select: { odometer: true } },
  insurancePolicy: { select: { id: true, endDate: true } },
  complianceDocument: { select: { id: true, kind: true, endDate: true } },
  sourceMaintenanceRecord: { select: { category: true } },
} satisfies Prisma.ReminderInclude;

type ReminderWithVehicle = Prisma.ReminderGetPayload<{ include: typeof REMINDER_INCLUDE }>;

/**
 * A reminder a service record is about to complete, read and its successor
 * worked out before the record's transaction opens (see `completeByRecord`).
 */
export type ReminderHandoff = {
  before: ReminderWithVehicle;
  next: Prisma.ReminderUncheckedCreateInput | null;
  now: Date;
};

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehiclesService: VehiclesService,
    private readonly auditService: AuditService,
    private readonly access: VehicleAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly serviceScheduleService: ServiceScheduleService,
    private readonly productEvents: ProductEventsService,
  ) {}

  async getAllReminders(userId: string) {
    const reminders = await this.prisma.reminder.findMany({
      where: {
        vehicle: { members: { some: { userId } } },
      },
      include: REMINDER_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const cadenceMap = await this.loadCadenceMap(
      Array.from(new Set(reminders.map((r) => r.vehicleId))),
    );

    return reminders
      .map((record) => this.toReminder(record, cadenceMap.get(record.vehicleId)))
      .sort((left, right) => this.compareReminders(left, right));
  }

  async listVehicleReminders(userId: string, vehicleId: string, query: ListRemindersQueryDto) {
    await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    return this.getPaginatedReminders(
      {
        vehicleId,
        vehicle: { members: { some: { userId } } },
      },
      query,
      vehicleId,
    );
  }

  async listReminders(userId: string, query: ListRemindersQueryDto) {
    return this.getPaginatedReminders(
      query.vehicleId
        ? {
            vehicleId: query.vehicleId,
            vehicle: { members: { some: { userId } } },
          }
        : {
            vehicle: { members: { some: { userId } } },
          },
      query,
    );
  }

  async getReminderById(userId: string, reminderId: string) {
    const reminder = await this.getStoredReminderById(userId, reminderId);
    const cadence = await this.loadCadenceForVehicle(reminder.vehicleId);

    return this.toReminder(reminder, cadence);
  }

  async createReminder(userId: string, vehicleId: string, payload: CreateReminderDto) {
    await this.access.assertEditor(userId, vehicleId);
    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);
    const input = this.validateCreateReminderInput({
      ...payload,
      vehicleId,
    });
    const reminder = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reminder.create({
        data: {
          vehicleId,
          title: input.title,
          type: input.type as PrismaReminderType,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          dueOdometer: input.dueOdometer,
          notes: input.notes,
          repeatEveryMonths: input.repeatEveryMonths ?? null,
          repeatEveryKm: input.repeatEveryKm ?? null,
          status: this.computeReminderStatus(
            { dueDate: input.dueDate, dueOdometer: input.dueOdometer },
            vehicle.odometer,
          ),
        },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.reminder.created,
        resourceType: AuditResourceType.reminder,
        resourceId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      await this.productEvents.record(tx, {
        name: 'reminder_created',
        userId,
        vehicleId,
        properties: { source: 'manual' },
      });
      // A renewal follows the vehicle's paper of its kind, when it has one.
      await linkRenewalReminder(
        { tx, auditService: this.auditService, actorUserId: userId },
        created.id,
      );
      return created;
    });

    return this.getReminderById(userId, reminder.id);
  }

  async updateReminder(userId: string, reminderId: string, payload: UpdateReminderDto) {
    const reminder = await this.getStoredReminderById(userId, reminderId);
    await this.access.assertEditor(userId, reminder.vehicleId);
    const input = this.validateUpdateReminderInput(payload);
    const paper = this.followedPaper(reminder);
    // Changing the type away from the paper's kind stops it following the paper.
    const unlinks =
      paper !== null && input.type !== undefined && renewalKindOf(input.type) !== paper.kind;
    if (paper && !unlinks && input.dueDate !== undefined && paper.endDate) {
      if (utcDayOf(new Date(input.dueDate)) !== utcDayOf(paper.endDate)) {
        throw new BadRequestException(
          'This reminder follows its paper: its due date is the paper’s end date. Change the paper instead.',
        );
      }
    }
    const dueDate =
      paper && !unlinks && paper.endDate
        ? paper.endDate.toISOString()
        : input.dueDate !== undefined
          ? input.dueDate
          : reminder.dueDate?.toISOString();
    const dueOdometer =
      input.dueOdometer !== undefined ? input.dueOdometer : (reminder.dueOdometer ?? undefined);
    const reminderStatus = this.computeReminderStatus(
      {
        dueDate,
        dueOdometer,
        completedAt: reminder.completedAt?.toISOString(),
      },
      reminder.vehicle.odometer,
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reminder.update({
        where: { id: reminderId },
        data: {
          title: input.title,
          type: input.type as PrismaReminderType,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          dueOdometer: input.dueOdometer,
          notes: input.notes,
          // Undefined leaves the rule as it is; null stops that dimension.
          repeatEveryMonths: input.repeatEveryMonths,
          repeatEveryKm: input.repeatEveryKm,
          status: reminderStatus,
          ...(unlinks ? { insurancePolicyId: null, complianceDocumentId: null } : {}),
        },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.reminder.updated,
        resourceType: AuditResourceType.reminder,
        resourceId: reminderId,
        before: reminder as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      if (!paper || unlinks) {
        await linkRenewalReminder(
          { tx, auditService: this.auditService, actorUserId: userId },
          reminderId,
        );
      }
    });

    return this.getReminderById(userId, reminderId);
  }

  async completeReminder(userId: string, reminderId: string) {
    const before = await this.getStoredReminderById(userId, reminderId);
    await this.access.assertEditor(userId, before.vehicleId);
    const now = new Date();

    // Resolved before the transaction opens: it reads the catalog, the vehicle
    // and the vehicle's tyre observations, and none of that belongs inside a
    // write transaction. Null for a reminder with no repeat rule.
    const next = await this.serviceScheduleService.buildNextOccurrence(userId, before, now);

    await this.prisma.$transaction(async (tx) => {
      await this.writeCompletion(tx, userId, before, next, now);
    });
    // Keeps the bell in step with the attention queue for this action — the
    // reminder just left the queue, so any due/overdue alert for it is moot.
    await this.notificationsService.markReadForReminder(userId, reminderId);

    return this.getReminderById(userId, reminderId);
  }

  /**
   * The first half of "saving the record completes the reminder": checks the
   * reminder a service record names (`reminderId`) and works out its next
   * occurrence, counted from the record's date and odometer rather than from
   * now. Runs before the record's transaction, for the same reason
   * `completeReminder` resolves its successor first. Null when the reminder
   * is already complete: saving the record again, or after someone ticked it
   * off, changes nothing. The caller has already asserted editor on the
   * vehicle.
   */
  async prepareCompletionByRecord(
    userId: string,
    vehicleId: string,
    reminderId: string,
    record: { serviceDate: Date; odometer: number },
  ): Promise<ReminderHandoff | null> {
    const before = await this.getStoredReminderById(userId, reminderId);
    if (before.vehicleId !== vehicleId) {
      throw new BadRequestException('That reminder belongs to another vehicle.');
    }
    if (before.completedAt) return null;

    const now = new Date();
    // A service logged for a future day is counted from today: an anchor never runs ahead.
    const from: RepeatAnchor = {
      odometer: record.odometer,
      at: record.serviceDate.getTime() < now.getTime() ? record.serviceDate : now,
    };
    const next = await this.serviceScheduleService.buildNextOccurrence(userId, before, now, from);
    return { before, next, now };
  }

  /**
   * The second half, inside the record's transaction and after its next-due
   * sync: completes the reminder and schedules its next occurrence. When the
   * record carries its own next-due (what the workshop wrote down), the
   * reminder that sync made is the next one, so no second is scheduled from
   * the rule; that reminder takes the rule on instead, so it keeps repeating.
   */
  async completeByRecord(
    tx: Prisma.TransactionClient,
    userId: string,
    handoff: ReminderHandoff,
    record: { id: string; nextDueDate: Date | null; nextDueOdometer: number | null },
  ): Promise<void> {
    const { before, next, now } = handoff;
    const recordSetsNext = record.nextDueDate !== null || record.nextDueOdometer !== null;
    // The sync may have closed it already: a record-made reminder of the same
    // kind is fulfilled by any newer service of that kind.
    const current = await tx.reminder.findUnique({
      where: { id: before.id },
      select: { completedAt: true },
    });
    if (current && !current.completedAt) {
      await this.writeCompletion(tx, userId, before, recordSetsNext ? null : next, now);
    }
    if (!recordSetsNext || !next) return;

    const made = await tx.reminder.findUnique({ where: { sourceMaintenanceRecordId: record.id } });
    if (
      !made ||
      made.completedAt ||
      made.repeatEveryMonths !== null ||
      made.repeatEveryKm !== null
    ) {
      return;
    }
    const updated = await tx.reminder.update({
      where: { id: made.id },
      data: {
        repeatEveryMonths: before.repeatEveryMonths,
        repeatEveryKm: before.repeatEveryKm,
        catalogSlug: made.catalogSlug ?? before.catalogSlug,
      },
    });
    await this.auditService.track(tx, {
      actorUserId: userId,
      ownerUserId: userId,
      action: AUDIT_ACTIONS.reminder.updated,
      resourceType: AuditResourceType.reminder,
      resourceId: made.id,
      before: made as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });
  }

  /** After `completeByRecord` commits: clears the bell for it, as `completeReminder` does. */
  async clearAlertsFor(userId: string, reminderId: string): Promise<void> {
    await this.notificationsService.markReadForReminder(userId, reminderId);
  }

  private async writeCompletion(
    tx: Prisma.TransactionClient,
    userId: string,
    before: ReminderWithVehicle,
    next: Prisma.ReminderUncheckedCreateInput | null,
    now: Date,
  ) {
    const updated = await tx.reminder.update({
      where: { id: before.id },
      data: { completedAt: now, status: ReminderStatus.Completed },
    });
    await this.auditService.track(tx, {
      actorUserId: userId,
      ownerUserId: userId,
      action: AUDIT_ACTIONS.reminder.completed,
      resourceType: AuditResourceType.reminder,
      resourceId: before.id,
      before: before as unknown as Record<string, unknown>,
      after: updated as unknown as Record<string, unknown>,
    });

    if (next) {
      const scheduled = await tx.reminder.create({ data: next });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.reminder.created,
        resourceType: AuditResourceType.reminder,
        resourceId: scheduled.id,
        after: scheduled as unknown as Record<string, unknown>,
      });
    }
  }

  /**
   * "Not now": moves the reminder a week on (the default), a month on, or to
   * a day the owner picks, counted from today or from its date if that is
   * later; where it counts kilometres, the target moves on by 500 km a week
   * (`reminderSnoozeTarget` in `@vehicle-vault/shared`, which the web's
   * preview runs too). It is an edit to the reminder, so it takes an editor,
   * and it clears the bell for it as completing does.
   */
  async snoozeReminder(userId: string, reminderId: string, payload: ReminderSnoozeInput = {}) {
    const before = await this.getStoredReminderById(userId, reminderId);
    await this.access.assertEditor(userId, before.vehicleId);
    if (before.completedAt) {
      throw new BadRequestException('A completed reminder cannot be snoozed');
    }
    if (linkedPaperId(before)) {
      throw new BadRequestException(
        'This reminder follows its paper: snooze the paper, or renew it.',
      );
    }

    const parsed = ReminderSnoozeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Snooze payload failed schema validation',
        details: parsed.error.flatten(),
      });
    }
    const now = new Date();
    const target = reminderSnoozeTarget(before, before.vehicle.odometer, parsed.data, now);
    if (!target) {
      throw new BadRequestException(
        'Pick a day after the reminder is due: a snooze moves it later, never sooner.',
      );
    }
    const { dueDate, dueOdometer } = target;
    const status = this.computeReminderStatus(
      { dueDate: dueDate?.toISOString(), dueOdometer: dueOdometer ?? undefined },
      before.vehicle.odometer,
    );

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reminder.update({
        where: { id: reminderId },
        data: { dueDate, dueOdometer, status },
      });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.reminder.updated,
        resourceType: AuditResourceType.reminder,
        resourceId: reminderId,
        before: before as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
    });
    await this.notificationsService.markReadForReminder(userId, reminderId);

    return this.getReminderById(userId, reminderId);
  }

  async deleteReminder(userId: string, reminderId: string) {
    const before = await this.getReminderById(userId, reminderId);
    await this.access.assertEditor(userId, before.vehicleId);
    await this.prisma.$transaction(async (tx) => {
      await tx.reminder.delete({ where: { id: reminderId } });
      await this.auditService.track(tx, {
        actorUserId: userId,
        ownerUserId: userId,
        action: AUDIT_ACTIONS.reminder.deleted,
        resourceType: AuditResourceType.reminder,
        resourceId: reminderId,
        before: before as unknown as Record<string, unknown>,
      });
    });

    return {
      id: reminderId,
      deleted: true,
    };
  }

  private async getPaginatedReminders(
    where: Prisma.ReminderWhereInput | undefined,
    query: ListRemindersQueryDto,
    vehicleId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const reminders = await this.prisma.reminder.findMany({
      where,
      include: REMINDER_INCLUDE,
      orderBy: {
        createdAt: 'desc',
      },
    });
    const cadenceMap = await this.loadCadenceMap(
      Array.from(new Set(reminders.map((r) => r.vehicleId))),
    );
    const computed = reminders.map((record) =>
      this.toReminder(record, cadenceMap.get(record.vehicleId)),
    );
    const filtered = query.status
      ? computed.filter((item) => item.status === query.status)
      : computed;
    const sorted = filtered.sort((left, right) => this.compareReminders(left, right));
    const start = (page - 1) * limit;

    return {
      data: sorted.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: sorted.length,
        ...(vehicleId ? { vehicleId } : {}),
      },
    };
  }

  private async getStoredReminderById(userId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        vehicle: { members: { some: { userId } } },
      },
      include: REMINDER_INCLUDE,
    });

    if (!reminder) {
      throw new NotFoundException(`Reminder ${reminderId} was not found`);
    }

    return reminder;
  }

  private toReminder(stored: ReminderWithVehicle, cadence?: UsageCadence): Reminder {
    const paper = this.followedPaper(stored);
    // While it follows a paper, the paper's end date is its due date. The
    // column is kept in step on every paper write; reading it from the paper
    // means no path that forgets can make the two disagree.
    const reminder =
      paper?.endDate && !stored.completedAt ? { ...stored, dueDate: paper.endDate } : stored;
    const status = this.computeReminderStatus(
      {
        dueDate: reminder.dueDate?.toISOString(),
        dueOdometer: reminder.dueOdometer ?? undefined,
        completedAt: reminder.completedAt?.toISOString(),
      },
      reminder.vehicle.odometer,
    );

    let usageProjection: Reminder['usageProjection'];
    if (
      cadence &&
      reminder.dueOdometer !== null &&
      reminder.dueOdometer !== undefined &&
      reminder.completedAt === null
    ) {
      const projected = projectDueDate(reminder.vehicle.odometer, reminder.dueOdometer, cadence);
      usageProjection = {
        projectedDueDate: projected.toISOString(),
        kmPerDay: Number(cadence.kmPerDay.toFixed(2)),
        confidence: cadence.confidence,
        sampleCount: cadence.sampleCount,
        sampleDays: cadence.sampleDays,
      };
    }

    return {
      id: reminder.id,
      vehicleId: reminder.vehicleId,
      title: reminder.title,
      type: reminder.type as ReminderType,
      dueDate: reminder.dueDate?.toISOString(),
      dueOdometer: reminder.dueOdometer ?? undefined,
      status,
      completedAt: reminder.completedAt?.toISOString(),
      notes: reminder.notes ?? undefined,
      catalogSlug: reminder.catalogSlug ?? undefined,
      logCategory: reminderLogCategory({
        type: reminder.type,
        catalogSlug: reminder.catalogSlug,
        sourceCategory: reminder.sourceMaintenanceRecord?.category ?? null,
        followsPaper: paper !== null,
      }),
      repeatEveryMonths: reminder.repeatEveryMonths ?? undefined,
      repeatEveryKm: reminder.repeatEveryKm ?? undefined,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
      ...(paper ? { renewsDocument: { kind: paper.kind, id: paper.id } } : {}),
      usageProjection,
    };
  }

  /** The paper a renewal reminder follows, as its kind, id and end date. */
  private followedPaper(
    reminder: Pick<ReminderWithVehicle, 'insurancePolicy' | 'complianceDocument'>,
  ): { kind: VehicleDocumentKind; id: string; endDate: Date | null } | null {
    if (reminder.insurancePolicy) {
      return { kind: 'insurance', ...reminder.insurancePolicy };
    }
    if (reminder.complianceDocument) {
      return reminder.complianceDocument;
    }
    return null;
  }

  private async loadCadenceMap(vehicleIds: string[]): Promise<Map<string, UsageCadence>> {
    const map = new Map<string, UsageCadence>();
    if (vehicleIds.length === 0) return map;

    const cutoff = new Date(
      Date.now() - USAGE_PROJECTION_FUEL_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const fuelLogs = await this.prisma.fuelLog.findMany({
      where: { vehicleId: { in: vehicleIds }, date: { gte: cutoff } },
      select: { vehicleId: true, date: true, odometer: true },
      orderBy: { date: 'asc' },
    });

    const grouped = new Map<string, { date: Date; odometer: number }[]>();
    for (const log of fuelLogs) {
      const list = grouped.get(log.vehicleId) ?? [];
      list.push({ date: log.date, odometer: log.odometer });
      grouped.set(log.vehicleId, list);
    }
    for (const [vehicleId, samples] of grouped.entries()) {
      const cadence = computeUsageCadence(
        samples,
        new Date(),
        USAGE_PROJECTION_FUEL_LOG_WINDOW_DAYS,
      );
      if (cadence) map.set(vehicleId, cadence);
    }
    return map;
  }

  private async loadCadenceForVehicle(vehicleId: string): Promise<UsageCadence | undefined> {
    const map = await this.loadCadenceMap([vehicleId]);
    return map.get(vehicleId);
  }

  private computeReminderStatus(
    reminder: {
      dueDate?: string;
      dueOdometer?: number;
      completedAt?: string;
    },
    currentOdometer?: number,
  ) {
    return computeReminderStatus(reminder, currentOdometer);
  }

  private compareReminders(left: Reminder, right: Reminder) {
    const statusDifference =
      reminderStatusPriority[right.status] - reminderStatusPriority[left.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const leftDueValue =
      (left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY) ||
      Number.POSITIVE_INFINITY;
    const rightDueValue =
      (right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY) ||
      Number.POSITIVE_INFINITY;

    if (left.status === ReminderStatus.Completed && right.status === ReminderStatus.Completed) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }

    if (leftDueValue !== rightDueValue) {
      return leftDueValue - rightDueValue;
    }

    const leftOdometer = left.dueOdometer ?? Number.POSITIVE_INFINITY;
    const rightOdometer = right.dueOdometer ?? Number.POSITIVE_INFINITY;

    if (leftOdometer !== rightOdometer) {
      return leftOdometer - rightOdometer;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }

  private validateCreateReminderInput(payload: CreateReminderDto & { vehicleId: string }) {
    const result = ReminderCreateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Reminder payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }

  private validateUpdateReminderInput(payload: UpdateReminderDto): UpdateReminderInput {
    const result = ReminderUpdateSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Reminder update payload failed schema validation',
        details: result.error.flatten(),
      });
    }

    return result.data;
  }
}

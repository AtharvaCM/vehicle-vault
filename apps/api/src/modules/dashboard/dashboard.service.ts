import { Injectable } from '@nestjs/common';
import {
  LoanStatus,
  ReminderStatus,
  VehicleRole,
  type DashboardAttentionCounts,
  type DashboardAttentionItem,
  type DashboardReminderSummary,
  type DashboardSummary,
  type DashboardUrgency,
  type DashboardVehicleDocumentStatus,
  type DashboardVehicleHealth,
  type DashboardVehicleLastService,
  type DashboardVehicleNextDue,
  type DashboardVehicleStatus,
  type MaintenanceRecord,
  type Reminder,
  type Vehicle,
  type VehicleDocument,
  type VehicleDocumentKind,
  type VehicleLoan,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RemindersService } from '../reminders/reminders.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { VehicleLoansService } from '../vehicle-loans/vehicle-loans.service';
import { VehiclesService } from '../vehicles/vehicles.service';

import { MaintenanceForecastService } from '../vehicles/maintenance-forecast.service';

const DASHBOARD_LIST_LIMIT = 5;
const DASHBOARD_ATTENTION_LIMIT = 25;
const DASHBOARD_VEHICLE_LIMIT = 50;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Expired documents older than this fall off the queue (they are still `expired` on the vehicle). */
const DOCUMENT_OVERDUE_WINDOW_DAYS = 90;
/** Odometer-only reminders enter the queue once the vehicle is within this many km of the target. */
const ODOMETER_ATTENTION_KM = 1000;
/**
 * How long a snoozed document row stays out of the queue. Only ever applied
 * to `this_week`/`this_month` urgency — an `overdue`/`today` row always
 * shows regardless of a live snooze, so this can't hide a document that is
 * actually due.
 */
const DOCUMENT_DISMISS_SNOOZE_DAYS = 14;
const THIS_WEEK_MAX_DAYS = 7;
const THIS_MONTH_MAX_DAYS = 30;

const URGENCY_RANK: Record<DashboardUrgency, number> = {
  overdue: 0,
  today: 1,
  this_week: 2,
  this_month: 3,
};

const VEHICLE_STATUS_RANK: Record<DashboardVehicleStatus, number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
};

const DOCUMENT_KIND_TITLES: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance policy',
  warranty: 'Warranty coverage',
  registration: 'Registration certificate',
  puc: 'PUC certificate',
  road_tax: 'Road tax',
};

/** Legally mandatory in India, so the vehicle card always reports them (state `missing` when absent). */
const MANDATORY_DOCUMENT_KINDS: readonly VehicleDocumentKind[] = ['insurance', 'puc'];

type VehicleSummaryRow = Awaited<ReturnType<VehiclesService['getAllVehicles']>>[number];

type AttentionVehicleFields = Pick<
  DashboardAttentionItem,
  'vehicleId' | 'vehicleName' | 'registrationNumber' | 'currentUserRole'
>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly maintenanceService: MaintenanceService,
    private readonly remindersService: RemindersService,
    private readonly attachmentsService: AttachmentsService,
    private readonly forecastService: MaintenanceForecastService,
    private readonly vehicleLoansService: VehicleLoansService,
    private readonly vehicleDocumentsService: VehicleDocumentsService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getSummary(userId: string): Promise<DashboardSummary> {
    // One clock reading per request so every bucket agrees on what "today" is.
    const now = new Date();
    const today = this.toUtcDay(now);

    const [
      vehicles,
      maintenanceRecords,
      reminders,
      attachments,
      loans,
      documents,
      fuelLogCount,
      dismissals,
    ] = await Promise.all([
      this.vehiclesService.getAllVehicles(userId),
      this.maintenanceService.getAllRecords(userId),
      this.remindersService.getAllReminders(userId),
      this.attachmentsService.listAllAttachments(userId),
      this.vehicleLoansService.listForUser(userId),
      this.vehicleDocumentsService.listForUser(userId),
      this.prisma.fuelLog.count({ where: { vehicle: { members: { some: { userId } } } } }),
      this.prisma.documentDismissal.findMany({
        where: { userId, dismissedUntil: { gt: now } },
        select: { documentId: true },
      }),
    ]);
    const dismissedDocumentIds = new Set(dismissals.map((d) => d.documentId));

    // Fetch individual vehicle insights
    const allForecasts = await Promise.all(
      vehicles.map((v) => this.forecastService.getUpcomingSuggestions(userId, v.id)),
    );

    const flattenedInsights = allForecasts
      .flat()
      .filter((i) => i.priority === 'high' || i.priority === 'medium')
      .sort((a, b) => {
        const priorities = { high: 0, medium: 1, low: 2 };
        return priorities[a.priority] - priorities[b.priority];
      })
      .slice(0, DASHBOARD_LIST_LIMIT);

    const vehicleLabelById = Object.fromEntries(
      vehicles.map((vehicle) => [
        vehicle.id,
        `${this.displayNameFor(vehicle)} • ${vehicle.registrationNumber}`,
      ]),
    );
    const attachmentCountByRecordId = attachments.reduce<Record<string, number>>(
      (counts, attachment) => {
        if (!attachment.maintenanceRecordId) return counts;
        counts[attachment.maintenanceRecordId] = (counts[attachment.maintenanceRecordId] ?? 0) + 1;

        return counts;
      },
      {},
    );

    const activeLoans = loans.filter((loan) => loan.status === LoanStatus.Active);
    const closedLoans = loans.filter((loan) => loan.status === LoanStatus.Closed);
    const nextEmiDate = activeLoans
      .map((loan) => this.nextEmiDateFor(loan))
      .filter((date) => date.getTime() >= now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const latestDocuments = this.latestDocumentPerVehicleKind(documents);
    const attention = this.buildAttention({
      vehicleById,
      reminders,
      latestDocuments,
      activeLoans,
      today,
      dismissedDocumentIds,
    });
    const vehicleHealth = this.buildVehicleHealth({
      vehicles,
      attention,
      latestDocuments,
      maintenanceRecords,
      today,
    });

    return {
      totalVehicles: vehicles.length,
      totalMaintenanceRecords: maintenanceRecords.length,
      totalAttachments: attachments.length,
      loans: {
        activeCount: activeLoans.length,
        closedCount: closedLoans.length,
        monthlyEmi: activeLoans.reduce((acc, loan) => acc + loan.emiAmount, 0),
        outstandingBalance: activeLoans.reduce((acc, loan) => acc + loan.outstandingBalance, 0),
        interestPaidToDate: loans.reduce((acc, loan) => acc + loan.interestPaidToDate, 0),
        prepaidToDate: loans.reduce((acc, loan) => acc + loan.prepaidToDate, 0),
        nextEmiDate: nextEmiDate ? nextEmiDate.toISOString() : null,
      },
      reminderCounts: {
        overdue: reminders.filter((reminder) => reminder.status === ReminderStatus.Overdue).length,
        dueToday: reminders.filter((reminder) => reminder.status === ReminderStatus.DueToday)
          .length,
        upcoming: reminders.filter((reminder) => reminder.status === ReminderStatus.Upcoming)
          .length,
        completed: reminders.filter((reminder) => reminder.status === ReminderStatus.Completed)
          .length,
      },
      insights: flattenedInsights,
      recentVehicles: vehicles.slice(0, DASHBOARD_LIST_LIMIT).map((vehicle) => ({
        id: vehicle.id,
        displayName: this.displayNameFor(vehicle),
        registrationNumber: vehicle.registrationNumber,
        vehicleType: vehicle.vehicleType,
        odometer: vehicle.odometer,
        updatedAt: vehicle.updatedAt,
      })),
      recentMaintenance: maintenanceRecords.slice(0, DASHBOARD_LIST_LIMIT).map((record) => ({
        id: record.id,
        vehicleId: record.vehicleId,
        vehicleLabel: vehicleLabelById[record.vehicleId] ?? 'Unknown vehicle',
        category: record.category,
        serviceDate: record.serviceDate,
        totalCost: record.totalCost,
        workshopName: record.workshopName,
        attachmentCount: attachmentCountByRecordId[record.id] ?? 0,
      })),
      upcomingReminders: reminders
        .filter(
          (reminder) =>
            reminder.status === ReminderStatus.DueToday ||
            reminder.status === ReminderStatus.Upcoming,
        )
        .sort((left, right) => this.compareByDueDate(left, right))
        .slice(0, DASHBOARD_LIST_LIMIT)
        .map((reminder) => this.toReminderSummary(reminder, vehicleLabelById)),
      overdueReminders: reminders
        .filter((reminder) => reminder.status === ReminderStatus.Overdue)
        .slice(0, DASHBOARD_LIST_LIMIT)
        .map((reminder) => this.toReminderSummary(reminder, vehicleLabelById)),
      attention: attention.slice(0, DASHBOARD_ATTENTION_LIMIT),
      attentionTotal: attention.length,
      attentionCounts: this.buildAttentionCounts(attention, vehicleHealth),
      vehicles: vehicleHealth.slice(0, DASHBOARD_VEHICLE_LIMIT),
      vehiclesTotal: vehicleHealth.length,
      hasSpend: maintenanceRecords.length > 0 || fuelLogCount > 0 || activeLoans.length > 0,
    };
  }

  /**
   * Snoozes a `this_week`/`this_month` document row out of the attention
   * queue for {@link DOCUMENT_DISMISS_SNOOZE_DAYS}, and marks its matching
   * `document-expiring` notification(s) read so the bell agrees with the
   * queue for this action. Any viewer on the vehicle may snooze — it is a
   * per-user preference, not a mutation of the document itself.
   */
  async snoozeDocumentAttention(
    userId: string,
    kind: VehicleDocumentKind,
    documentId: string,
  ): Promise<void> {
    const document = await this.vehicleDocumentsService.assertViewable(userId, kind, documentId);

    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + DOCUMENT_DISMISS_SNOOZE_DAYS);

    await this.prisma.documentDismissal.upsert({
      where: { userId_documentId: { userId, documentId: document.id } },
      create: { userId, documentId: document.id, documentKind: kind, dismissedUntil },
      update: { documentKind: kind, dismissedUntil },
    });

    await this.notificationsService.markReadForDocument(userId, document.id);
  }

  // ---------------------------------------------------------------------------
  // Attention queue
  // ---------------------------------------------------------------------------

  private buildAttention(input: {
    vehicleById: Map<string, VehicleSummaryRow>;
    reminders: Reminder[];
    latestDocuments: Map<string, VehicleDocument>;
    activeLoans: VehicleLoan[];
    today: number;
    dismissedDocumentIds: ReadonlySet<string>;
  }): DashboardAttentionItem[] {
    const { vehicleById, reminders, latestDocuments, activeLoans, today, dismissedDocumentIds } =
      input;
    const items: DashboardAttentionItem[] = [];

    for (const reminder of reminders) {
      if (reminder.status === ReminderStatus.Completed) continue;
      const vehicle = vehicleById.get(reminder.vehicleId);
      if (!vehicle) continue;

      const dueDate = reminder.dueDate ?? null;
      const daysUntilDue = dueDate === null ? null : this.daysUntil(today, dueDate);
      const kmUntilDue =
        reminder.dueOdometer === undefined ? undefined : reminder.dueOdometer - vehicle.odometer;
      const urgency = this.reminderUrgency(reminder.status, daysUntilDue, kmUntilDue);
      if (!urgency) continue;

      items.push({
        ...this.attentionVehicleFields(vehicle),
        id: reminder.id,
        kind: 'reminder',
        urgency,
        title: reminder.title,
        reminderType: reminder.type,
        reminderStatus: reminder.status,
        dueDate,
        daysUntilDue,
        dueOdometer: reminder.dueOdometer,
        kmUntilDue,
      });
    }

    for (const document of latestDocuments.values()) {
      // A superseded policy never shows as expired: only the latest per
      // (vehicle, kind) is considered, and an open-ended one never expires.
      if (document.endDate === null) continue;
      const vehicle = vehicleById.get(document.vehicleId);
      if (!vehicle) continue;

      const daysUntilDue = this.daysUntil(today, document.endDate);
      const urgency = this.documentUrgency(daysUntilDue);
      if (!urgency) continue;
      // A snooze only defers the heads-up window; it never hides a document
      // that has actually come due.
      const snoozeEligible = urgency !== 'overdue' && urgency !== 'today';
      if (snoozeEligible && dismissedDocumentIds.has(document.id)) continue;

      items.push({
        ...this.attentionVehicleFields(vehicle),
        id: document.id,
        kind: 'document',
        urgency,
        title: DOCUMENT_KIND_TITLES[document.kind],
        documentKind: document.kind,
        provider: document.provider,
        dueDate: document.endDate.toISOString(),
        daysUntilDue,
      });
    }

    for (const loan of activeLoans) {
      const vehicle = vehicleById.get(loan.vehicleId);
      if (!vehicle) continue;

      const nextEmi = this.nextEmiDateFor(loan);
      const daysUntilDue = this.daysUntil(today, nextEmi);
      const urgency = this.emiUrgency(daysUntilDue);
      if (!urgency) continue;

      items.push({
        ...this.attentionVehicleFields(vehicle),
        id: `emi:${loan.id}`,
        kind: 'loan_emi',
        urgency,
        title: 'Loan EMI',
        loanId: loan.id,
        amount: loan.emiAmount,
        dueDate: nextEmi.toISOString(),
        daysUntilDue,
      });
    }

    return items.sort((left, right) => this.compareAttention(left, right));
  }

  /**
   * Urgency comes from the reminder's own status so a queue row can never
   * contradict the reminder list; only the "how soon" bucketing is local.
   */
  private reminderUrgency(
    status: ReminderStatus,
    daysUntilDue: number | null,
    kmUntilDue: number | undefined,
  ): DashboardUrgency | null {
    if (status === ReminderStatus.Overdue) return 'overdue';
    if (status === ReminderStatus.DueToday) return 'today';
    if (status !== ReminderStatus.Upcoming) return null;

    if (daysUntilDue === null) {
      return kmUntilDue !== undefined && kmUntilDue <= ODOMETER_ATTENTION_KM ? 'this_month' : null;
    }

    return this.dateUrgency(daysUntilDue);
  }

  private documentUrgency(daysUntilDue: number): DashboardUrgency | null {
    if (daysUntilDue < 0) {
      return daysUntilDue >= -DOCUMENT_OVERDUE_WINDOW_DAYS ? 'overdue' : null;
    }
    if (daysUntilDue === 0) return 'today';

    return this.dateUrgency(daysUntilDue);
  }

  private emiUrgency(daysUntilDue: number): DashboardUrgency | null {
    if (daysUntilDue === 0) return 'today';
    if (daysUntilDue >= 1 && daysUntilDue <= THIS_WEEK_MAX_DAYS) return 'this_week';

    return null;
  }

  /** Future-dated bucketing shared by every kind: 1–7 this week, 8–30 this month, else nothing. */
  private dateUrgency(daysUntilDue: number): DashboardUrgency | null {
    if (daysUntilDue >= 1 && daysUntilDue <= THIS_WEEK_MAX_DAYS) return 'this_week';
    if (daysUntilDue > THIS_WEEK_MAX_DAYS && daysUntilDue <= THIS_MONTH_MAX_DAYS) {
      return 'this_month';
    }

    return null;
  }

  /**
   * Urgency bucket first; within a bucket dated items by days-until-due,
   * then odometer-only items by km-until-due, then title.
   */
  private compareAttention(left: DashboardAttentionItem, right: DashboardAttentionItem): number {
    const rankDifference = URGENCY_RANK[left.urgency] - URGENCY_RANK[right.urgency];
    if (rankDifference !== 0) return rankDifference;

    const leftDated = left.daysUntilDue !== null;
    const rightDated = right.daysUntilDue !== null;
    if (leftDated !== rightDated) return leftDated ? -1 : 1;

    if (left.daysUntilDue !== null && right.daysUntilDue !== null) {
      if (left.daysUntilDue !== right.daysUntilDue) return left.daysUntilDue - right.daysUntilDue;
    } else {
      const leftKm = left.kmUntilDue ?? Number.POSITIVE_INFINITY;
      const rightKm = right.kmUntilDue ?? Number.POSITIVE_INFINITY;
      if (leftKm !== rightKm) return leftKm < rightKm ? -1 : 1;
    }

    return left.title.localeCompare(right.title);
  }

  private buildAttentionCounts(
    attention: DashboardAttentionItem[],
    vehicleHealth: DashboardVehicleHealth[],
  ): DashboardAttentionCounts {
    const overdue = attention.filter((item) => item.urgency === 'overdue').length;
    const today = attention.filter((item) => item.urgency === 'today').length;
    const thisWeek = attention.filter((item) => item.urgency === 'this_week').length;
    const thisMonth = attention.filter((item) => item.urgency === 'this_month').length;

    return {
      overdue,
      today,
      thisWeek,
      thisMonth,
      documentsExpiring30d: attention.filter((item) => item.kind === 'document').length,
      vehiclesNeedingAttention: vehicleHealth.filter((vehicle) => vehicle.status !== 'ok').length,
      total: overdue + today + thisWeek + thisMonth,
    };
  }

  // ---------------------------------------------------------------------------
  // Vehicle health
  // ---------------------------------------------------------------------------

  private buildVehicleHealth(input: {
    vehicles: VehicleSummaryRow[];
    attention: DashboardAttentionItem[];
    latestDocuments: Map<string, VehicleDocument>;
    maintenanceRecords: MaintenanceRecord[];
    today: number;
  }): DashboardVehicleHealth[] {
    const { vehicles, attention, latestDocuments, maintenanceRecords, today } = input;

    const attentionByVehicle = new Map<string, DashboardAttentionItem[]>();
    for (const item of attention) {
      const list = attentionByVehicle.get(item.vehicleId);
      if (list) {
        list.push(item);
      } else {
        attentionByVehicle.set(item.vehicleId, [item]);
      }
    }

    const lastServiceByVehicle = new Map<string, MaintenanceRecord>();
    for (const record of maintenanceRecords) {
      const current = lastServiceByVehicle.get(record.vehicleId);
      if (!current || this.toUtcDay(record.serviceDate) > this.toUtcDay(current.serviceDate)) {
        lastServiceByVehicle.set(record.vehicleId, record);
      }
    }

    const documentsByVehicle = new Map<string, VehicleDocument[]>();
    for (const document of latestDocuments.values()) {
      const list = documentsByVehicle.get(document.vehicleId);
      if (list) {
        list.push(document);
      } else {
        documentsByVehicle.set(document.vehicleId, [document]);
      }
    }

    return vehicles
      .map((vehicle): DashboardVehicleHealth => {
        const items = attentionByVehicle.get(vehicle.id) ?? [];
        const overdueCount = items.filter((item) => item.urgency === 'overdue').length;
        const dueSoonCount = items.length - overdueCount;
        const status: DashboardVehicleStatus =
          overdueCount > 0 ? 'overdue' : dueSoonCount > 0 ? 'due_soon' : 'ok';

        return {
          id: vehicle.id,
          displayName: this.displayNameFor(vehicle),
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
          odometer: vehicle.odometer,
          currentUserRole: vehicle.currentUserRole ?? VehicleRole.Owner,
          status,
          overdueCount,
          dueSoonCount,
          nextDue: this.nextDueFor(items),
          documents: this.documentStatusesFor(documentsByVehicle.get(vehicle.id) ?? [], today),
          lastService: this.toLastService(lastServiceByVehicle.get(vehicle.id)),
        };
      })
      .sort((left, right) => {
        const rankDifference = VEHICLE_STATUS_RANK[left.status] - VEHICLE_STATUS_RANK[right.status];
        if (rankDifference !== 0) return rankDifference;

        return left.displayName.localeCompare(right.displayName);
      });
  }

  /** The first reminder or document in queue order; EMIs never become "next due". */
  private nextDueFor(items: DashboardAttentionItem[]): DashboardVehicleNextDue | null {
    const next = items.find((item) => item.kind === 'reminder' || item.kind === 'document');
    if (!next || next.kind === 'loan_emi') return null;

    return {
      kind: next.kind,
      targetId: next.id,
      title: next.title,
      dueDate: next.dueDate,
      daysUntilDue: next.daysUntilDue,
      dueOdometer: next.dueOdometer,
    };
  }

  private documentStatusesFor(
    documents: VehicleDocument[],
    today: number,
  ): Partial<Record<VehicleDocumentKind, DashboardVehicleDocumentStatus>> {
    const statuses: Partial<Record<VehicleDocumentKind, DashboardVehicleDocumentStatus>> = {};
    for (const kind of MANDATORY_DOCUMENT_KINDS) {
      statuses[kind] = { state: 'missing', endDate: null };
    }

    for (const document of documents) {
      if (document.endDate === null) {
        statuses[document.kind] = { state: 'active', endDate: null };
        continue;
      }

      const daysUntilDue = this.daysUntil(today, document.endDate);
      statuses[document.kind] = {
        state:
          daysUntilDue < 0
            ? 'expired'
            : daysUntilDue <= THIS_MONTH_MAX_DAYS
              ? 'expiring'
              : 'active',
        endDate: document.endDate.toISOString(),
      };
    }

    return statuses;
  }

  private toLastService(record: MaintenanceRecord | undefined): DashboardVehicleLastService | null {
    if (!record) return null;

    return {
      recordId: record.id,
      serviceDate: record.serviceDate,
      odometer: record.odometer,
      category: record.category,
    };
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /**
   * Latest document per (vehicle, kind), decided by startDate: a renewal always
   * starts after what it replaces, so a renewed policy hides the one it replaced
   * and a dated certificate entered after an open-ended one is not masked by it.
   * Equal start dates fall back to endDate, where null (open-ended) ranks latest.
   */
  private latestDocumentPerVehicleKind(documents: VehicleDocument[]): Map<string, VehicleDocument> {
    const latest = new Map<string, VehicleDocument>();
    for (const document of documents) {
      const key = `${document.vehicleId}:${document.kind}`;
      const current = latest.get(key);
      if (!current || this.isMoreRecentDocument(document, current)) {
        latest.set(key, document);
      }
    }

    return latest;
  }

  private isMoreRecentDocument(candidate: VehicleDocument, current: VehicleDocument): boolean {
    const startDifference = candidate.startDate.getTime() - current.startDate.getTime();
    if (startDifference !== 0) return startDifference > 0;

    return this.endDateRank(candidate) > this.endDateRank(current);
  }

  private endDateRank(document: VehicleDocument): number {
    return document.endDate === null ? Number.POSITIVE_INFINITY : document.endDate.getTime();
  }

  /**
   * Next instalment = startDate + (elapsed + 1) months, with the day clamped into the
   * target month so a loan started on the 31st is due on the 28th/30th of shorter
   * months instead of spilling into the month after.
   */
  private nextEmiDateFor(loan: VehicleLoan): Date {
    const elapsed = loan.tenureMonths - loan.monthsRemaining;
    const start = new Date(loan.startDate);
    const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + elapsed + 1, 1));
    const daysInTargetMonth = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(start.getUTCDate(), daysInTargetMonth));
    target.setUTCHours(
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    );

    return target;
  }

  private attentionVehicleFields(vehicle: VehicleSummaryRow): AttentionVehicleFields {
    return {
      vehicleId: vehicle.id,
      vehicleName: this.displayNameFor(vehicle),
      registrationNumber: vehicle.registrationNumber,
      currentUserRole: vehicle.currentUserRole ?? VehicleRole.Owner,
    };
  }

  private displayNameFor(vehicle: Pick<Vehicle, 'nickname' | 'make' | 'model'>): string {
    return vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
  }

  private toReminderSummary(
    reminder: Reminder,
    vehicleLabelById: Record<string, string>,
  ): DashboardReminderSummary {
    return {
      id: reminder.id,
      vehicleId: reminder.vehicleId,
      vehicleLabel: vehicleLabelById[reminder.vehicleId] ?? 'Unknown vehicle',
      title: reminder.title,
      type: reminder.type,
      status: reminder.status,
      dueDate: reminder.dueDate,
      dueOdometer: reminder.dueOdometer,
      updatedAt: reminder.updatedAt,
    };
  }

  /** Soonest due date first; odometer-only reminders (no dueDate) keep their relative order at the end. */
  private compareByDueDate(left: Reminder, right: Reminder): number {
    const leftDue = left.dueDate ? this.toUtcDay(left.dueDate) : Number.POSITIVE_INFINITY;
    const rightDue = right.dueDate ? this.toUtcDay(right.dueDate) : Number.POSITIVE_INFINITY;
    if (leftDue === rightDue) return 0;

    return leftDue < rightDue ? -1 : 1;
  }

  /** Whole UTC calendar days from `today` (a `toUtcDay` value) to `value`; negative when past. */
  private daysUntil(today: number, value: string | Date): number {
    return Math.round((this.toUtcDay(value) - today) / MS_PER_DAY);
  }

  /** Midnight-UTC timestamp of the UTC date — mirrors `RemindersService.toUtcDayTimestamp`. */
  private toUtcDay(value: string | Date): number {
    const date = value instanceof Date ? value : new Date(value);

    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }
}

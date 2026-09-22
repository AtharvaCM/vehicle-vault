import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LoanStatus,
  MaintenanceRecordStatus,
  ReminderStatus,
  VehicleRole,
  requiresPuc,
  type DashboardAttentionCounts,
  type DashboardAttentionItem,
  type DashboardSummary,
  type DashboardUrgency,
  type DashboardVehicleDocumentStatus,
  type DashboardVehicleHealth,
  type DashboardVehicleLastService,
  type DashboardVehicleNextDue,
  type DashboardVehicleStatus,
  type FuelType,
  type MaintenanceRecord,
  type Reminder,
  type Vehicle,
  type VehicleDocument,
  type VehicleDocumentKind,
  type VehicleLoan,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AccessoriesService } from '../accessories/accessories.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { MaintenanceService } from '../maintenance/maintenance.service';
import {
  EDITOR_ONLY_KINDS,
  isAlertedFromMeasurements,
  serviceHistoryVerdicts,
  tyreVerdicts,
  type AlertVerdict,
} from '../notifications/alert-verdicts';
import { NotificationsService } from '../notifications/notifications.service';
import { positionLabel } from '../notifications/templates/tyre-labels';
import { RemindersService } from '../reminders/reminders.service';
import { unansweredCategories } from '../service-baseline/service-history-coverage';
import { TyresService } from '../tyres/tyres.service';
import { isMoreRecentDocument } from '../vehicle-documents/document-recency';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { VehicleLoansService } from '../vehicle-loans/vehicle-loans.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { VehiclesService } from '../vehicles/vehicles.service';

import { MaintenanceForecastService } from '../vehicles/maintenance-forecast.service';
import { computeDataHealth } from './data-health';

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

/**
 * The documents the law in India requires of a vehicle, which its card reports
 * even when none is on file (state `missing`): insurance always, and a PUC
 * unless the vehicle is electric and so exempt.
 */
function mandatoryDocumentKinds(fuelType: FuelType): readonly VehicleDocumentKind[] {
  return requiresPuc(fuelType) ? ['insurance', 'puc'] : ['insurance'];
}

/**
 * The bell's tyre titles, in the queue's sentence case. The position goes in
 * the detail line instead of the title, so a phone-width row keeps it.
 */
const TYRE_WORN_TITLES = {
  illegal: 'Tyre not roadworthy',
  replace: 'Replace tyre',
  warn: 'Tyre wearing down',
} as const;
const TYRE_AGED_TITLES = { replace: 'Tyre aged out', warn: 'Tyre ageing' } as const;

/** How many unanswered categories a service-history row names before it says "and N more". */
const SERVICE_HISTORY_NAMED_CATEGORIES = 2;

type VehicleSummaryRow = Awaited<ReturnType<VehiclesService['getAllVehicles']>>[number];

/** The verdicts the queue shows: the ones the bell raises about tyres and service history. */
type QueueVerdict = AlertVerdict<
  'tyre-worn' | 'tyre-aged' | 'tyre-uninspected' | 'service-baseline-unknown'
>;

type ExpiringAccessory = Awaited<ReturnType<AccessoriesService['findExpiringWarranties']>>[number];

/** What the dashboard reads about each vehicle beyond its own row, fetched once per vehicle. */
type VehicleFacts = {
  /** The engine's verdicts this user hears, by the engine's audience rule. */
  verdicts: QueueVerdict[];
  /** At least one road tyre on file; a spare alone tells the app nothing about wear. */
  roadTyresTracked: boolean;
  /** Service categories that apply to the vehicle, and those not yet answered. */
  serviceCategories: number;
  unansweredServiceCategories: number;
};

type BaselineRow = Prisma.ServiceBaselineGetPayload<{
  select: { vehicleId: true; category: true; status: true; lastDoneOdometer: true };
}>;

function km(value: number): string {
  return `${Math.max(0, Math.round(value)).toLocaleString('en-IN')} km`;
}

/** "engine_oil" → "engine oil". */
function categoryWords(category: string): string {
  return category.replace(/_/g, ' ');
}

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
    private readonly tyresService: TyresService,
    private readonly accessoriesService: AccessoriesService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
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
      fuelLogLatestDates,
      baselines,
      expiringAccessories,
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
      this.prisma.fuelLog.groupBy({
        by: ['vehicleId'],
        where: { vehicle: { members: { some: { userId } } } },
        _max: { date: true },
      }),
      this.prisma.serviceBaseline.findMany({
        where: { vehicle: { members: { some: { userId } } } },
        select: { vehicleId: true, category: true, status: true, lastDoneOdometer: true },
      }),
      // The engine's own lookup, with the queue's 30-day look-ahead in place of
      // the bell's seven days, as for documents.
      this.accessoriesService.findExpiringWarranties(userId, THIS_MONTH_MAX_DAYS),
    ]);
    const dismissedDocumentIds = new Set(dismissals.map((d) => d.documentId));
    const latestFuelLogDateByVehicle = new Map(
      fuelLogLatestDates
        .filter((row) => row._max.date !== null)
        .map((row) => [row.vehicleId, row._max.date as Date]),
    );

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
    const factsByVehicle = await this.vehicleFactsFor({
      userId,
      vehicles,
      maintenanceRecords,
      baselines,
      now,
    });
    const attention = this.buildAttention({
      vehicleById,
      reminders,
      latestDocuments,
      activeLoans,
      factsByVehicle,
      expiringAccessories,
      today,
      dismissedDocumentIds,
    });
    const vehicleHealth = this.buildVehicleHealth({
      vehicles,
      attention,
      latestDocuments,
      maintenanceRecords,
      latestFuelLogDateByVehicle,
      factsByVehicle,
      now,
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
      recentMaintenance: maintenanceRecords.slice(0, DASHBOARD_LIST_LIMIT).map((record) => ({
        id: record.id,
        vehicleId: record.vehicleId,
        vehicleLabel: vehicleLabelById[record.vehicleId] ?? 'Unknown vehicle',
        category: record.category,
        serviceDate: record.serviceDate,
        totalCost: record.totalCost,
        workshopName: record.workshopName,
        attachmentCount: attachmentCountByRecordId[record.id] ?? 0,
        // A draft stays in the list so it can be found and confirmed, marked so
        // it does not read as a logged service.
        status: record.status ?? MaintenanceRecordStatus.Confirmed,
      })),
      attention: attention.slice(0, DASHBOARD_ATTENTION_LIMIT),
      attentionTotal: attention.length,
      attentionCounts: this.buildAttentionCounts(attention, vehicleHealth),
      vehicles: vehicleHealth.slice(0, DASHBOARD_VEHICLE_LIMIT),
      vehiclesTotal: vehicleHealth.length,
      // The spend section reads analytics, which count confirmed records only.
      hasSpend:
        maintenanceRecords.some((record) => record.status !== MaintenanceRecordStatus.Draft) ||
        fuelLogCount > 0 ||
        activeLoans.length > 0,
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

  /**
   * The alert engine's tyre and service-history verdicts on every vehicle the
   * user can see, from the functions the engine raises them from and the same
   * rows it reads: confirmed records only, every baseline, the resolved
   * intervals, the tyres' graded state. The data score reads the same rows.
   *
   * Who hears a verdict is the engine's rule too: a question that asks someone
   * to record something reaches only the members who can, so a viewer's queue
   * never shows one.
   */
  private async vehicleFactsFor(input: {
    userId: string;
    vehicles: VehicleSummaryRow[];
    maintenanceRecords: MaintenanceRecord[];
    baselines: BaselineRow[];
    now: Date;
  }): Promise<Map<string, VehicleFacts>> {
    const { userId, vehicles, maintenanceRecords, baselines, now } = input;
    const confirmedByVehicle = this.groupByVehicle(
      maintenanceRecords.filter((record) => record.status === MaintenanceRecordStatus.Confirmed),
    );
    const baselinesByVehicle = this.groupByVehicle(baselines);

    const entries = await Promise.all(
      vehicles.map(async (vehicle): Promise<[string, VehicleFacts]> => {
        const confirmedRecords = confirmedByVehicle.get(vehicle.id) ?? [];
        const vehicleBaselines = baselinesByVehicle.get(vehicle.id) ?? [];
        const [tyreState, intervals] = await Promise.all([
          this.tyresService.getAlertState(userId, vehicle.id),
          this.intervalResolver.resolveForVehicle(vehicle),
        ]);
        const verdictVehicle = {
          id: vehicle.id,
          year: vehicle.year,
          odometer: vehicle.odometer,
          createdAt: new Date(vehicle.createdAt),
        };
        const verdicts: QueueVerdict[] = [
          ...serviceHistoryVerdicts(
            {
              vehicle: verdictVehicle,
              intervals,
              confirmedRecords,
              baselines: vehicleBaselines,
            },
            now,
          ),
          ...tyreVerdicts(verdictVehicle, tyreState, now),
        ];
        const canRecord = (vehicle.currentUserRole ?? VehicleRole.Owner) !== VehicleRole.Viewer;

        return [
          vehicle.id,
          {
            verdicts: verdicts.filter(
              (verdict) => canRecord || !EDITOR_ONLY_KINDS.has(verdict.kind),
            ),
            roadTyresTracked: tyreState.lastObservation !== null,
            serviceCategories: Object.keys(intervals).length,
            unansweredServiceCategories: unansweredCategories(
              intervals,
              confirmedRecords,
              vehicleBaselines,
            ).length,
          },
        ];
      }),
    );

    return new Map(entries);
  }

  private buildAttention(input: {
    vehicleById: Map<string, VehicleSummaryRow>;
    reminders: Reminder[];
    latestDocuments: Map<string, VehicleDocument>;
    activeLoans: VehicleLoan[];
    factsByVehicle: Map<string, VehicleFacts>;
    expiringAccessories: ExpiringAccessory[];
    today: number;
    dismissedDocumentIds: ReadonlySet<string>;
  }): DashboardAttentionItem[] {
    const {
      vehicleById,
      reminders,
      latestDocuments,
      activeLoans,
      factsByVehicle,
      expiringAccessories,
      today,
      dismissedDocumentIds,
    } = input;
    const items: DashboardAttentionItem[] = [];

    for (const reminder of reminders) {
      if (reminder.status === ReminderStatus.Completed) continue;
      // The tyre walk-around is judged from the readings, as in the bell: the
      // `tyre-check` row below, not this one.
      if (isAlertedFromMeasurements(reminder)) continue;
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
        provider: document.provider ?? undefined,
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

    for (const [vehicleId, facts] of factsByVehicle) {
      const vehicle = vehicleById.get(vehicleId);
      if (!vehicle) continue;

      items.push(...this.verdictRows(this.attentionVehicleFields(vehicle), facts.verdicts));
    }

    for (const accessory of expiringAccessories) {
      const vehicle = vehicleById.get(accessory.vehicleId);
      if (!vehicle || !accessory.warrantyExpiresAt) continue;

      // The lookup starts at today, so nothing here has run out; a warranty
      // ending before today's UTC date is only a server-timezone edge.
      const daysUntilDue = Math.max(0, this.daysUntil(today, accessory.warrantyExpiresAt));
      const urgency = this.documentUrgency(daysUntilDue);
      if (!urgency) continue;

      items.push({
        ...this.attentionVehicleFields(vehicle),
        id: `accessory:${accessory.id}`,
        kind: 'accessory',
        urgency,
        title: `${accessory.brand ? `${accessory.brand} ${accessory.name}` : accessory.name} warranty`,
        dueDate: accessory.warrantyExpiresAt.toISOString(),
        daysUntilDue,
      });
    }

    return items.sort((left, right) => this.compareAttention(left, right));
  }

  /**
   * One row per tyre the engine would raise, and one per vehicle for each
   * question it would ask. The categories whose history is unknown share one
   * row: the bell asks about each on its own rhythm, but they are answered on
   * the same screen, and a row apiece would bury everything else coming up.
   */
  private verdictRows(
    vehicle: AttentionVehicleFields,
    verdicts: QueueVerdict[],
  ): DashboardAttentionItem[] {
    const rows: DashboardAttentionItem[] = [];
    const unknownCategories: string[] = [];
    const undated = { dueDate: null, daysUntilDue: null } as const;

    for (const verdict of verdicts) {
      switch (verdict.kind) {
        case 'tyre-worn': {
          const { payload } = verdict;
          rows.push({
            ...vehicle,
            ...undated,
            id: `tyre:${payload.tyreId}`,
            kind: 'tyre',
            urgency: payload.level === 'warn' ? 'this_month' : 'overdue',
            title: TYRE_WORN_TITLES[payload.level],
            detail: `${positionLabel(payload.position)} · ${
              payload.treadDepthMm === null
                ? payload.summary
                : `${payload.treadDepthMm.toFixed(1)} mm tread`
            }`,
          });
          break;
        }
        case 'tyre-aged': {
          const { payload } = verdict;
          rows.push({
            ...vehicle,
            ...undated,
            id: `tyre:${payload.tyreId}`,
            kind: 'tyre',
            urgency: payload.level === 'warn' ? 'this_month' : 'overdue',
            title: TYRE_AGED_TITLES[payload.level],
            detail: `${positionLabel(payload.position)} · ${
              payload.ageYears === null
                ? payload.summary
                : `${payload.ageYears.toFixed(1)} years old`
            }`,
          });
          break;
        }
        case 'tyre-uninspected': {
          const { payload } = verdict;
          rows.push({
            ...vehicle,
            ...undated,
            id: `tyre-check:${payload.vehicleId}`,
            kind: 'tyre',
            urgency: 'this_month',
            ...(payload.reason === 'untracked'
              ? { title: 'Tyres not tracked', detail: `None on file at ${km(payload.odometer)}` }
              : {
                  title: 'Time to check the tyres',
                  detail: `Last measured ${km(payload.kmSinceLastCheck)} and ${
                    payload.daysSinceLastCheck
                  } day${payload.daysSinceLastCheck === 1 ? '' : 's'} ago`,
                }),
          });
          break;
        }
        case 'service-baseline-unknown': {
          const { payload } = verdict;
          if (payload.scope === 'category') {
            unknownCategories.push(payload.category);
            break;
          }
          rows.push({
            ...vehicle,
            ...undated,
            id: `service-history:${payload.vehicleId}`,
            kind: 'service_baseline',
            urgency: 'this_month',
            title: 'Add this vehicle’s service history',
            detail: `None on file at ${km(payload.odometer)}`,
          });
          break;
        }
      }
    }

    if (unknownCategories.length > 0) {
      const named = unknownCategories.slice(0, SERVICE_HISTORY_NAMED_CATEGORIES).map(categoryWords);
      const more = unknownCategories.length - named.length;
      const list = more > 0 ? `${named.join(', ')} and ${more} more` : named.join(' and ');

      rows.push({
        ...vehicle,
        ...undated,
        id: `service-history:${vehicle.vehicleId}`,
        kind: 'service_baseline',
        urgency: 'this_month',
        title: 'Unknown service history',
        detail: `${list.charAt(0).toUpperCase()}${list.slice(1)}`,
      });
    }

    return rows;
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
    const urgentVehicles = new Set(
      attention.filter((item) => item.urgency !== 'this_month').map((item) => item.vehicleId),
    ).size;

    return {
      overdue,
      today,
      thisWeek,
      thisMonth,
      documentsExpiring30d: attention.filter((item) => item.kind === 'document').length,
      vehiclesNeedingAttention: vehicleHealth.filter((vehicle) => vehicle.status !== 'ok').length,
      urgentVehicles,
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
    latestFuelLogDateByVehicle: Map<string, Date>;
    factsByVehicle: Map<string, VehicleFacts>;
    now: Date;
    today: number;
  }): DashboardVehicleHealth[] {
    const {
      vehicles,
      attention,
      latestDocuments,
      maintenanceRecords,
      latestFuelLogDateByVehicle,
      factsByVehicle,
      now,
      today,
    } = input;

    const attentionByVehicle = new Map<string, DashboardAttentionItem[]>();
    for (const item of attention) {
      const list = attentionByVehicle.get(item.vehicleId);
      if (list) {
        list.push(item);
      } else {
        attentionByVehicle.set(item.vehicleId, [item]);
      }
    }

    // A draft is not a service that happened: the card would read "Serviced
    // today" for a scan started this morning and count kilometres from it.
    const lastServiceByVehicle = new Map<string, MaintenanceRecord>();
    for (const record of maintenanceRecords) {
      if (record.status === MaintenanceRecordStatus.Draft) continue;
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
        const latestFuelLogDate = latestFuelLogDateByVehicle.get(vehicle.id);
        const odometerUpdatedAt =
          latestFuelLogDate && latestFuelLogDate.getTime() > new Date(vehicle.updatedAt).getTime()
            ? latestFuelLogDate.toISOString()
            : vehicle.updatedAt;
        const documents = this.documentStatusesFor(
          documentsByVehicle.get(vehicle.id) ?? [],
          vehicle.fuelType,
          today,
        );
        const facts = factsByVehicle.get(vehicle.id);

        return {
          id: vehicle.id,
          displayName: this.displayNameFor(vehicle),
          registrationNumber: vehicle.registrationNumber,
          vehicleType: vehicle.vehicleType,
          fuelType: vehicle.fuelType,
          odometer: vehicle.odometer,
          odometerUpdatedAt,
          currentUserRole: vehicle.currentUserRole ?? VehicleRole.Owner,
          status,
          overdueCount,
          dueSoonCount,
          nextDue: this.nextDueFor(items),
          documents,
          lastService: this.toLastService(lastServiceByVehicle.get(vehicle.id)),
          dataHealth: computeDataHealth({
            fuelType: vehicle.fuelType,
            catalogVariantId: vehicle.catalogVariantId,
            purchasePrice: vehicle.purchasePrice,
            serviceCategories: facts?.serviceCategories ?? 0,
            unansweredServiceCategories: facts?.unansweredServiceCategories ?? 0,
            insurance: documents.insurance?.state ?? 'missing',
            puc: documents.puc?.state ?? 'missing',
            odometerUpdatedAt: new Date(odometerUpdatedAt),
            roadTyresTracked: facts?.roadTyresTracked ?? false,
            now,
          }),
        };
      })
      .sort((left, right) => {
        const rankDifference = VEHICLE_STATUS_RANK[left.status] - VEHICLE_STATUS_RANK[right.status];
        if (rankDifference !== 0) return rankDifference;

        return left.displayName.localeCompare(right.displayName);
      });
  }

  /** The first row in queue order; EMIs never become "next due". */
  private nextDueFor(items: DashboardAttentionItem[]): DashboardVehicleNextDue | null {
    const next = items.find((item) => item.kind !== 'loan_emi');
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
    fuelType: FuelType,
    today: number,
  ): Partial<Record<VehicleDocumentKind, DashboardVehicleDocumentStatus>> {
    const statuses: Partial<Record<VehicleDocumentKind, DashboardVehicleDocumentStatus>> = {};
    for (const kind of mandatoryDocumentKinds(fuelType)) {
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
      if (!current || isMoreRecentDocument(document, current)) {
        latest.set(key, document);
      }
    }

    return latest;
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

  private groupByVehicle<T extends { vehicleId: string }>(rows: readonly T[]): Map<string, T[]> {
    const byVehicle = new Map<string, T[]>();
    for (const row of rows) {
      const list = byVehicle.get(row.vehicleId);
      if (list) {
        list.push(row);
      } else {
        byVehicle.set(row.vehicleId, [row]);
      }
    }

    return byVehicle;
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

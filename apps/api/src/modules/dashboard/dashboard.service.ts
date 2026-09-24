import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  LoanStatus,
  MaintenanceRecordStatus,
  ReminderStatus,
  UPCOMING_KINDS_BY_FILTER,
  VehicleRole,
  requiresPuc,
  upcomingGroupOf,
  type DashboardAttentionCounts,
  type DashboardAttentionItem,
  type DashboardSummary,
  type DashboardVehicleDocumentStatus,
  type DashboardVehicleHealth,
  type DashboardVehicleLastService,
  type DashboardVehicleNextDue,
  type DashboardVehicleStatus,
  type FuelType,
  type MaintenanceRecord,
  type UpcomingGroupCounts,
  type UpcomingItem,
  type UpcomingKindFilter,
  type UpcomingTimeline,
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
  serviceHistoryVerdicts,
  tyreVerdicts,
} from '../notifications/alert-verdicts';
import { NotificationsService } from '../notifications/notifications.service';
import { RemindersService } from '../reminders/reminders.service';
import { unansweredCategories } from '../service-baseline/service-history-coverage';
import { TyresService } from '../tyres/tyres.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { VehicleLoansService } from '../vehicle-loans/vehicle-loans.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { VehiclesService } from '../vehicles/vehicles.service';

import { MaintenanceForecastService } from '../vehicles/maintenance-forecast.service';
import { computeDataHealth } from './data-health';
import {
  THIS_MONTH_MAX_DAYS,
  buildDueItems,
  daysUntil,
  displayNameFor,
  isAttentionItem,
  latestDocumentPerVehicleKind,
  nextEmiDateFor,
  toUtcDay,
  type QueueVerdict,
} from './due-items';

const DASHBOARD_LIST_LIMIT = 5;
const DASHBOARD_ATTENTION_LIMIT = 25;
const DASHBOARD_VEHICLE_LIMIT = 50;

/**
 * How long a snoozed document row stays out of the queue. Only ever applied
 * to `this_week`/`this_month` urgency — an `overdue`/`today` row always
 * shows regardless of a live snooze, so this can't hide a document that is
 * actually due.
 */
const DOCUMENT_DISMISS_SNOOZE_DAYS = 14;
/**
 * How far ahead Upcoming reads accessory warranties. Home reads 30 days; the
 * rows past that land in `later`, which is all this adds.
 */
const UPCOMING_ACCESSORY_HORIZON_DAYS = 5 * 366;

/**
 * The one definition of "needs attention": overdue, due today, or due within
 * seven days. The headline, the "vehicles needing
 * attention" tile and each garage card's status all count from it; a
 * `this_month` row is "coming up", never attention.
 */
function needsAttention(item: DashboardAttentionItem): boolean {
  return item.urgency !== 'this_month';
}

const VEHICLE_STATUS_RANK: Record<DashboardVehicleStatus, number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
};

/**
 * The documents the law in India requires of a vehicle, which its card reports
 * even when none is on file (state `missing`): insurance always, and a PUC
 * unless the vehicle is electric and so exempt.
 */
function mandatoryDocumentKinds(fuelType: FuelType): readonly VehicleDocumentKind[] {
  return requiresPuc(fuelType) ? ['insurance', 'puc'] : ['insurance'];
}

type VehicleSummaryRow = Awaited<ReturnType<VehiclesService['getAllVehicles']>>[number];

type DueSources = Awaited<ReturnType<DashboardService['loadDueSources']>>;

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
    const today = toUtcDay(now);

    const [sources, attachments, fuelLogCount, fuelLogLatestDates] = await Promise.all([
      // The engine's own accessory lookup, with the queue's 30-day look-ahead
      // in place of the bell's seven days, as for documents.
      this.loadDueSources(userId, now, THIS_MONTH_MAX_DAYS),
      this.attachmentsService.listAllAttachments(userId),
      this.prisma.fuelLog.count({ where: { vehicle: { members: { some: { userId } } } } }),
      this.prisma.fuelLog.groupBy({
        by: ['vehicleId'],
        where: { vehicle: { members: { some: { userId } } } },
        _max: { date: true },
      }),
    ]);
    const { vehicles, maintenanceRecords, reminders, loans } = sources;
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
        `${displayNameFor(vehicle)} • ${vehicle.registrationNumber}`,
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

    const closedLoans = loans.filter((loan) => loan.status === LoanStatus.Closed);
    const { dueItems, activeLoans, latestDocuments, factsByVehicle } = await this.classifyDue(
      userId,
      sources,
      now,
    );
    // Home is the timeline's near end: everything but what waits for later.
    const attention = dueItems.filter(isAttentionItem);
    const nextEmiDate = activeLoans
      .map((loan) => nextEmiDateFor(loan))
      .filter((date) => date.getTime() >= now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

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
      attentionCounts: this.buildAttentionCounts(attention),
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
   * The Upcoming timeline: Home's attention rows, classified by the same code
   * from the same sources, plus the rows Home leaves for later. Filtered by
   * vehicle and kind; only the `later` group is paged, so the groups Home
   * counts are always whole.
   */
  async getUpcoming(
    userId: string,
    query: { vehicleId?: string; kind?: UpcomingKindFilter; page?: number; limit?: number },
  ): Promise<{ timeline: UpcomingTimeline; laterTotal: number; page: number; limit: number }> {
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sources = await this.loadDueSources(userId, now, UPCOMING_ACCESSORY_HORIZON_DAYS);
    if (query.vehicleId) {
      sources.vehicles = sources.vehicles.filter((vehicle) => vehicle.id === query.vehicleId);
    }

    const { dueItems } = await this.classifyDue(userId, sources, now);
    const kinds = query.kind ? UPCOMING_KINDS_BY_FILTER[query.kind] : null;
    const filtered = kinds ? dueItems.filter((item) => kinds.includes(item.kind)) : dueItems;

    const counts: UpcomingGroupCounts = { late: 0, this_week: 0, this_month: 0, later: 0 };
    for (const item of filtered) counts[upcomingGroupOf(item.urgency)] += 1;

    const near = filtered.filter((item) => item.urgency !== 'later');
    const later = filtered.filter((item) => item.urgency === 'later');
    const start = (page - 1) * limit;

    return {
      timeline: { items: [...near, ...later.slice(start, start + limit)], counts },
      laterTotal: later.length,
      page,
      limit,
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
  // Attention queue and Upcoming timeline
  // ---------------------------------------------------------------------------

  /** Everything the due-item classification reads, fetched in one round. */
  private async loadDueSources(userId: string, now: Date, accessoryHorizonDays: number) {
    const [
      vehicles,
      maintenanceRecords,
      reminders,
      loans,
      documents,
      dismissals,
      baselines,
      expiringAccessories,
    ] = await Promise.all([
      this.vehiclesService.getAllVehicles(userId),
      this.maintenanceService.getAllRecords(userId),
      this.remindersService.getAllReminders(userId),
      this.vehicleLoansService.listForUser(userId),
      this.vehicleDocumentsService.listForUser(userId),
      this.prisma.documentDismissal.findMany({
        where: { userId, dismissedUntil: { gt: now } },
        select: { documentId: true, dismissedUntil: true },
      }),
      this.prisma.serviceBaseline.findMany({
        where: { vehicle: { members: { some: { userId } } } },
        select: { vehicleId: true, category: true, status: true, lastDoneOdometer: true },
      }),
      this.accessoriesService.findExpiringWarranties(userId, accessoryHorizonDays),
    ]);

    return {
      vehicles,
      maintenanceRecords,
      reminders,
      loans,
      documents,
      dismissals,
      baselines,
      expiringAccessories,
    };
  }

  /** The sources run through the shared classification, plus what Home reads on the way. */
  private async classifyDue(
    userId: string,
    sources: DueSources,
    now: Date,
  ): Promise<{
    dueItems: UpcomingItem[];
    activeLoans: VehicleLoan[];
    latestDocuments: Map<string, VehicleDocument>;
    factsByVehicle: Map<string, VehicleFacts>;
  }> {
    const { vehicles, maintenanceRecords, reminders, loans, documents, dismissals, baselines } =
      sources;
    const activeLoans = loans.filter((loan) => loan.status === LoanStatus.Active);
    const latestDocuments = latestDocumentPerVehicleKind(documents);
    const factsByVehicle = await this.vehicleFactsFor({
      userId,
      vehicles,
      maintenanceRecords,
      baselines,
      now,
    });
    const dueItems = buildDueItems({
      vehicleById: new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
      reminders,
      latestDocuments,
      activeLoans,
      verdictsByVehicle: new Map(
        [...factsByVehicle].map(([vehicleId, facts]) => [vehicleId, facts.verdicts]),
      ),
      expiringAccessories: sources.expiringAccessories,
      today: toUtcDay(now),
      documentSnoozes: new Map(dismissals.map((row) => [row.documentId, row.dismissedUntil])),
    });

    return { dueItems, activeLoans, latestDocuments, factsByVehicle };
  }

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

  private buildAttentionCounts(attention: DashboardAttentionItem[]): DashboardAttentionCounts {
    const overdue = attention.filter((item) => item.urgency === 'overdue').length;
    const today = attention.filter((item) => item.urgency === 'today').length;
    const thisWeek = attention.filter((item) => item.urgency === 'this_week').length;
    const thisMonth = attention.filter((item) => item.urgency === 'this_month').length;
    const urgentVehicles = new Set(attention.filter(needsAttention).map((item) => item.vehicleId))
      .size;

    return {
      overdue,
      today,
      thisWeek,
      thisMonth,
      documentsExpiring30d: attention.filter((item) => item.kind === 'document').length,
      // The headline's figure, not a count of card statuses: the cards are
      // capped at DASHBOARD_VEHICLE_LIMIT, and both come from the same set.
      vehiclesNeedingAttention: urgentVehicles,
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
      if (!current || toUtcDay(record.serviceDate) > toUtcDay(current.serviceDate)) {
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
        // A `this_month` row is "coming up": it can be the card's next due, but
        // it never turns the card amber.
        const dueSoonCount = items.filter(needsAttention).length - overdueCount;
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
          displayName: displayNameFor(vehicle),
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

  /**
   * The first row in queue order, EMIs included. The queue sorts by urgency, so
   * whatever gives the card its status is the row it names: a "1 due soon"
   * badge always has its cause beside it.
   */
  private nextDueFor(items: DashboardAttentionItem[]): DashboardVehicleNextDue | null {
    const next = items[0];
    if (!next) return null;

    return {
      kind: next.kind,
      targetId: next.id,
      title: next.title,
      dueDate: next.dueDate,
      daysUntilDue: next.daysUntilDue,
      dueOdometer: next.dueOdometer,
      ...(next.amount !== undefined ? { amount: next.amount } : {}),
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

      const daysUntilDue = daysUntil(today, document.endDate);
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
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VehicleRole } from '@prisma/client';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { pickLatestDocument } from '../vehicle-documents/document-recency';
import { AccessoriesService } from '../accessories/accessories.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { TyresService } from '../tyres/tyres.service';
import {
  distanceIntervals,
  EDITOR_ONLY_KINDS,
  isAlertedFromMeasurements,
  serviceHistoryVerdicts,
  tyreVerdicts,
} from './alert-verdicts';
import type { AlertKind, AlertPayloads, ReminderAlertBasis } from './types';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import {
  ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS,
  MaintenanceRecordStatus,
} from '@vehicle-vault/shared';

const DOCUMENT_EXPIRY_WINDOW_DAYS = 7;
/**
 * A dated reminder gets the same heads-up as an expiring document, because to
 * the person receiving it they are the same nudge: something falls due on a
 * calendar day and there is still time to act.
 */
const REMINDER_DUE_WINDOW_DAYS = DOCUMENT_EXPIRY_WINDOW_DAYS;
/** How close an odometer target must be before it is worth saying anything. */
const ODOMETER_ALERT_WINDOW_KM = 500;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The cold-start prompts — `tyre-uninspected` for a vehicle with no tyres on
// file, and the vehicle-scope `service-baseline-unknown` — ask the owner to
// tell the app what it does not know. The 9 September cron raised 30 of them,
// mostly to accounts idle for six months, and they would have greeted a vehicle
// added the day before. The new-vehicle grace is part of the verdict (see
// `alert-verdicts`); these two numbers are delivery, keeping the prompts for
// people who are listening and polite to everyone else. See `raisePrompt`.

/** No audited action for this long and a prompt stays in the app instead of interrupting anyone. */
const PROMPT_DORMANT_AFTER_DAYS = 60;
/** A prompt once asked — then read, ignored or deleted — is not asked again for this long. */
const PROMPT_COOLDOWN_DAYS = 90;

/**
 * Who hears about a vehicle: the people it is shared with, not the legacy owner
 * column. Everyone is told what is due or wrong with it; only the members who
 * can record something are asked to.
 */
type Audience = {
  /** Every member — owner, editors and viewers. */
  everyone: string[];
  /** The owner and editors: the members who can answer a request to log something. */
  editors: string[];
};

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * MS_PER_DAY);
}

/**
 * Whole UTC calendar days from today to `target`; negative once it is past.
 *
 * UTC rather than the host's midnight, mirroring
 * `RemindersService.toUtcDayTimestamp`: a reminder's due day is a UTC day
 * throughout the app, and an engine that counted it in local days would
 * disagree with the status shown on the reminder itself.
 */
function daysUntilUtcDay(now: Date, target: Date): number {
  const startOfUtcDay = (value: Date) =>
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());

  return Math.round((startOfUtcDay(target) - startOfUtcDay(now)) / MS_PER_DAY);
}

@Injectable()
export class MaintenanceAlertService {
  private readonly logger = new Logger(MaintenanceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleInsightsService: VehicleInsightsService,
    private readonly notifyService: NotifyService,
    private readonly vehicleDocumentsService: VehicleDocumentsService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
    private readonly accessoriesService: AccessoriesService,
    private readonly tyresService: TyresService,
  ) {}

  /**
   * Run the alert engine for a specific vehicle.
   * This checks current predicted odometer against last maintenance records.
   */
  async runAlertChecks(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        maintenanceRecords: {
          // Confirmed only. A draft is an unconfirmed intention — typically a
          // record hydrated from a document extraction that nobody has agreed
          // to yet — and counting it as "this service was done" silences the
          // very reminder the user still needs. Filtered in the query rather
          // than after the fact so the engine cannot accidentally measure from
          // a row it should not see, and so the daily sweep over every vehicle
          // stops loading drafts it would only throw away.
          where: { status: MaintenanceRecordStatus.Confirmed },
          orderBy: { odometer: 'desc' },
        },
        // Loaded with the vehicle rather than fetched per category: this runs
        // once per vehicle in a loop over every vehicle in the database, and a
        // baseline is a small child row of the vehicle already being read.
        serviceBaselines: true,
        // The alert audience, read in the same query for the same reason.
        members: { select: { userId: true, role: true } },
      },
    });

    if (!vehicle) return;

    const audience = this.audienceOf(vehicle);

    // One clock for the whole run, so two checks cannot land on different sides
    // of midnight and disagree about what is due.
    const now = new Date();

    // 1. Get current predicted odometer
    const insights = await this.vehicleInsightsService.getOdometerInsights(
      vehicle.userId,
      vehicleId,
    );
    const currentOdo = insights.currentOdometerPredicted;

    // 2. Check each category for due service. Intervals come from the
    // resolver: per-variant catalog data when the vehicle is linked,
    // type/fuel-gated defaults otherwise (km-based alerting only —
    // month-based intervals surface through the forecast, not alerts).
    const intervals = await this.intervalResolver.resolveForVehicle(vehicle);
    const history = {
      vehicle,
      intervals,
      confirmedRecords: vehicle.maintenanceRecords,
      baselines: vehicle.serviceBaselines,
    };

    for (const { category, intervalKm, lastDone } of distanceIntervals(history)) {
      // Nothing honest to measure from; step 2b says so where it is worth saying.
      if (lastDone.kind !== 'measured') continue;

      const distanceSinceLast = currentOdo - lastDone.odometer;
      const remainingDistance = intervalKm - distanceSinceLast;

      // Alert if due within the odometer window or already overdue
      if (remainingDistance <= ODOMETER_ALERT_WINDOW_KM) {
        const kind = remainingDistance < 0 ? 'maintenance-overdue' : 'maintenance-due';
        await this.raiseToMembers(audience, vehicle.id, kind, {
          vehicleId: vehicle.id,
          category,
          remainingDistanceKm: remainingDistance,
        });
      }
    }

    // 2b. What the app does not know about the vehicle's history: nothing at
    // all, asked once for the whole vehicle as a cold-start prompt, or the
    // categories its owner has said they cannot answer, each a plain alert.
    for (const verdict of serviceHistoryVerdicts(history, now)) {
      if (verdict.payload.scope === 'vehicle') {
        await this.raisePrompt(audience, vehicle.id, verdict.kind, verdict.payload, now);
      } else {
        await this.raiseToMembers(audience, vehicle.id, verdict.kind, verdict.payload);
      }
    }

    // 3. Reminders the owner set themselves. Both timings are checked here: an
    // odometer mark the vehicle is approaching, and a due date the calendar has
    // reached. Date-only reminders — every renewal, and every month-based item
    // the service schedule produces — used to be excluded by the query and so
    // reached nobody.
    const reminders = await this.prisma.reminder.findMany({
      where: {
        vehicleId,
        status: { not: 'completed' },
        // A renewal that follows a paper is announced by the paper's own
        // expiry alert: one renewal, one notification.
        insurancePolicyId: null,
        complianceDocumentId: null,
        OR: [{ dueOdometer: { not: null } }, { dueDate: { not: null } }],
      },
    });

    for (const reminder of reminders) {
      if (isAlertedFromMeasurements(reminder)) continue;

      const signal = this.resolveReminderSignal(reminder, currentOdo, now);
      if (!signal) continue;

      const payload = {
        reminderId: reminder.id,
        vehicleId: vehicle.id,
        title: reminder.title,
        ...signal.basis,
      };

      // Spelled out per kind rather than passed as a variable: `raise` is
      // generic over the kind, and a union would widen the payload it accepts.
      if (signal.kind === 'reminder-overdue') {
        await this.raiseToMembers(audience, vehicle.id, 'reminder-overdue', payload);
      } else {
        await this.raiseToMembers(audience, vehicle.id, 'reminder-due', payload);
      }
    }

    // 4. Document expiry (insurance, warranty, future kinds).
    // Range query replaces the previous 1-day cron slice — alerts no longer
    // drop silently when the cron drifts.
    const expiring = await this.vehicleDocumentsService.findExpiring(
      vehicle.userId,
      DOCUMENT_EXPIRY_WINDOW_DAYS,
    );

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (const doc of expiring) {
      if (doc.vehicleId !== vehicleId) continue;
      if (!doc.endDate) continue;
      const daysUntilExpiry = Math.max(
        0,
        Math.ceil((doc.endDate.getTime() - today.getTime()) / MS_PER_DAY),
      );
      await this.raiseToMembers(audience, doc.vehicleId, 'document-expiring', {
        document: doc,
        daysUntilExpiry,
      });
    }

    // 4b. A warranty's distance limit. Warranties usually end at a date or a
    // distance, whichever comes first: the date is covered above, and this
    // watches the distance, with the window distance-based services use.
    await this.checkWarrantyDistance(audience, vehicle.id, currentOdo);

    // 5. Accessory warranty expiry. Same shape as document expiry: a calendar
    // date on a record, bucketed by the same template helper so the two alerts
    // dedupe on the same rhythm.
    const expiringWarranties = await this.accessoriesService.findExpiringWarranties(
      vehicle.userId,
      ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS,
    );

    for (const accessory of expiringWarranties) {
      if (accessory.vehicleId !== vehicleId) continue;
      if (!accessory.warrantyExpiresAt) continue;
      const daysUntilExpiry = Math.max(
        0,
        Math.ceil((accessory.warrantyExpiresAt.getTime() - today.getTime()) / MS_PER_DAY),
      );
      await this.raiseToMembers(audience, accessory.vehicleId, 'accessory-warranty-expiring', {
        accessory,
        daysUntilExpiry,
      });
    }

    // 6. Tyres. Tread and age are the two wear limits an odometer-driven service
    // schedule cannot express — a tyre reaches the legal minimum between
    // services, and rubber ages out whether or not the vehicle moves. The
    // grading already existed for the vehicle page; without this call nothing
    // reached the user unless they went looking.
    const tyreState = await this.tyresService.getAlertState(vehicle.userId, vehicle.id);
    for (const verdict of tyreVerdicts(vehicle, tyreState, now)) {
      // Spelled out per kind, as for reminders above, so each payload keeps its type.
      if (verdict.kind === 'tyre-worn') {
        await this.raiseToMembers(audience, vehicle.id, verdict.kind, verdict.payload);
      } else if (verdict.kind === 'tyre-aged') {
        await this.raiseToMembers(audience, vehicle.id, verdict.kind, verdict.payload);
      } else if (verdict.payload.reason === 'untracked') {
        await this.raisePrompt(audience, vehicle.id, verdict.kind, verdict.payload, now);
      } else {
        await this.raiseToMembers(audience, vehicle.id, verdict.kind, verdict.payload);
      }
    }
  }

  /**
   * Everyone the vehicle is shared with, from its VehicleMember rows. Every
   * vehicle has had an owner row since sharing shipped — created with the
   * vehicle, backfilled before that — so the owner column is only a fallback
   * for one that has somehow lost it, where it keeps the old behaviour.
   */
  private audienceOf(vehicle: {
    userId: string;
    members: { userId: string; role: VehicleRole }[];
  }): Audience {
    if (vehicle.members.length === 0) {
      return { everyone: [vehicle.userId], editors: [vehicle.userId] };
    }

    return {
      everyone: vehicle.members.map((member) => member.userId),
      editors: vehicle.members
        .filter((member) => member.role !== VehicleRole.viewer)
        .map((member) => member.userId),
    };
  }

  private recipientsFor(audience: Audience, kind: AlertKind): string[] {
    return EDITOR_ONLY_KINDS.has(kind) ? audience.editors : audience.everyone;
  }

  /**
   * One raise per recipient. Dedup, cooldowns and channel gating (a verified
   * address, an unmuted inbox) are all per user in NotifyService, so each member
   * gets their own row and their own delivery, and a re-run adds nothing.
   */
  private async raiseToMembers<K extends AlertKind>(
    audience: Audience,
    vehicleId: string,
    kind: K,
    payload: AlertPayloads[K],
  ) {
    for (const userId of this.recipientsFor(audience, kind)) {
      await this.notifyService.raise(userId, vehicleId, kind, payload);
    }
  }

  /**
   * Whether a reminder is worth telling its owner about, and on what grounds.
   *
   * A reminder may be timed by distance, by date, or by both, and each timing
   * produces at most one verdict: due once it is inside its window, overdue
   * once it is past. Both timings together still produce a single notification
   * — one task should not arrive twice in a morning — and overdue wins, since
   * "you have already missed this" is the truer of the two sentences.
   *
   * When both timings are merely due, the odometer one is reported. Neither is
   * more urgent in any comparable unit (500 km and 6 days do not rank against
   * each other), so the tie goes to the wording that shipped first.
   */
  private resolveReminderSignal(
    reminder: { dueOdometer: number | null; dueDate: Date | null },
    currentOdometer: number,
    now: Date,
  ): { kind: 'reminder-due' | 'reminder-overdue'; basis: ReminderAlertBasis } | null {
    const signals: { kind: 'reminder-due' | 'reminder-overdue'; basis: ReminderAlertBasis }[] = [];

    if (reminder.dueOdometer != null) {
      const remainingDistanceKm = reminder.dueOdometer - currentOdometer;
      if (remainingDistanceKm <= ODOMETER_ALERT_WINDOW_KM) {
        signals.push({
          kind: remainingDistanceKm < 0 ? 'reminder-overdue' : 'reminder-due',
          basis: { basis: 'odometer', dueOdometer: reminder.dueOdometer, remainingDistanceKm },
        });
      }
    }

    if (reminder.dueDate != null) {
      const daysUntilDue = daysUntilUtcDay(now, reminder.dueDate);
      // Due *today* is due, not overdue — the same boundary the reminder's own
      // status uses, so a notification cannot contradict the row it came from.
      if (daysUntilDue <= REMINDER_DUE_WINDOW_DAYS) {
        signals.push({
          kind: daysUntilDue < 0 ? 'reminder-overdue' : 'reminder-due',
          basis: { basis: 'date', dueDate: reminder.dueDate, daysUntilDue },
        });
      }
    }

    return signals.find((signal) => signal.kind === 'reminder-overdue') ?? signals[0] ?? null;
  }

  /**
   * Raise one of the two cold-start prompts, politely.
   *
   * Whether to ask at all is the verdict's call, new-vehicle grace included
   * (see `alert-verdicts`). How to ask is decided here, by two rules, neither of
   * which touches the condition alerts (`tyre-worn`, `tyre-aged`, the
   * category-scope baseline) — those describe something true about the vehicle
   * and go out regardless:
   *
   * - The same prompt for the same vehicle is not asked twice in 90 days,
   *   whether it was read, ignored or deleted. The dedup key alone only guards
   *   unread rows, so a prompt someone read and chose to ignore used to come
   *   back the next morning.
   * - Someone who has done nothing in 60 days still gets the row, so it is
   *   waiting in the app if they return, but no email and no push. Waking a
   *   dormant account to ask it a question is how a notification becomes spam.
   *
   * Dormancy is judged per recipient, so fanning an alert out to more than one
   * person decides it separately for each of them.
   */
  private async raisePrompt<K extends 'tyre-uninspected' | 'service-baseline-unknown'>(
    audience: Audience,
    vehicleId: string,
    kind: K,
    payload: AlertPayloads[K],
    now: Date,
  ) {
    for (const userId of this.recipientsFor(audience, kind)) {
      await this.notifyService.raise(userId, vehicleId, kind, payload, {
        cooldownDays: PROMPT_COOLDOWN_DAYS,
        inAppOnly: await this.isDormant(userId, now),
      });
    }
  }

  /**
   * No audited action by this user in the dormancy window.
   *
   * Any action counts, sign-ins included: the question is whether anyone is
   * around to read a prompt, and signing in is the plainest evidence there is.
   * A failed sign-in is the exception — it is recorded against the account it
   * targeted, so without excluding it a stranger guessing passwords would keep
   * a dormant account looking active.
   */
  private async isDormant(userId: string, now: Date): Promise<boolean> {
    const recent = await this.prisma.auditEvent.findFirst({
      where: {
        actorUserId: userId,
        occurredAt: { gte: daysBefore(now, PROMPT_DORMANT_AFTER_DAYS) },
        action: { not: AUDIT_ACTIONS.auth.loginFailed },
      },
      select: { id: true },
    });

    return recent === null;
  }

  /**
   * The vehicle's warranty of record against its distance limit. Only that one
   * counts: an extended warranty supersedes the manufacturer's, whose limit is
   * usually long past, and a warranty whose date has already run out is over
   * whatever the odometer says. Everyone the vehicle is shared with hears it;
   * see warranty-odometer.template.ts for the wording and dedup.
   */
  private async checkWarrantyDistance(
    audience: Audience,
    vehicleId: string,
    currentOdometer: number,
  ) {
    const warranties = await this.prisma.warranty.findMany({ where: { vehicleId } });
    const current = pickLatestDocument(
      warranties.map((warranty) => ({
        id: warranty.id,
        vehicleId: warranty.vehicleId,
        kind: 'warranty' as const,
        provider: warranty.provider,
        number: warranty.warrantyNumber,
        startDate: warranty.startDate,
        endDate: warranty.endDate,
        notes: warranty.notes,
        details: {},
        createdAt: warranty.createdAt,
        updatedAt: warranty.updatedAt,
      })),
    );
    const warranty = warranties.find((row) => row.id === current?.id);
    if (!warranty || warranty.endOdometer === null) return;
    if (warranty.endDate && warranty.endDate.getTime() < Date.now()) return;

    const remainingKm = warranty.endOdometer - currentOdometer;
    if (remainingKm > ODOMETER_ALERT_WINDOW_KM) return;

    await this.raiseToMembers(audience, vehicleId, 'warranty-odometer', {
      warranty: {
        id: warranty.id,
        vehicleId: warranty.vehicleId,
        provider: warranty.provider,
        type: warranty.type,
        endOdometer: warranty.endOdometer,
      },
      remainingKm,
    });
  }

  /**
   * Trigger checks for ALL vehicles.
   * This is called automatically every day at 6:00 AM.
   */
  @Cron(process.env.MAINTENANCE_ALERT_CRON || '0 6 * * *')
  async runDailyChecks() {
    if (process.env.NODE_ENV === 'development') {
      return;
    }
    this.logger.log('Starting daily maintenance alert checks...');
    const vehicles = await this.prisma.vehicle.findMany({
      select: { id: true },
    });

    for (const v of vehicles) {
      try {
        await this.runAlertChecks(v.id);
      } catch (e) {
        this.logger.error(`Failed alert check for vehicle ${v.id}`, e);
      }
    }
    this.logger.log(`Completed alert checks for ${vehicles.length} vehicles.`);
  }
}

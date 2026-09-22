import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
// The Prisma enum rather than the shared one: these rows come straight off the
// vehicle include, and re-casting them to the wire enum would be ceremony over
// two identical string unions.
import { ServiceBaselineStatus, VehicleRole } from '@prisma/client';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { pickLatestDocument } from '../vehicle-documents/document-recency';
import { AccessoriesService } from '../accessories/accessories.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { TyresService, type VehicleTyreAlertState } from '../tyres/tyres.service';
// Pure functions, not a provider: importing them does not make the
// notifications module depend on the reminders module, which would close a
// cycle (reminders → notifications → tyres).
import { extractSlugFromNotes, TYRE_INSPECTION_SLUG } from '../reminders/catalog-marker';
import type { AlertKind, AlertPayloads, ReminderAlertBasis } from './types';
import { AUDIT_ACTIONS } from '../audit/audit.actions';
import {
  ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS,
  SERVICE_HISTORY_PROMPT_KM,
  TYRE_INSPECTION_INTERVAL_KM,
  TYRE_INSPECTION_INTERVAL_MONTHS,
  TYRE_TRACKING_PROMPT_KM,
  VEHICLE_AGE_PROMPT_YEARS,
  MaintenanceRecordStatus,
  type MaintenanceCategory,
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
// added the day before. These three numbers keep them for people who are
// listening and polite to everyone else. See `raisePrompt`.

/** A vehicle this new is still being set up; asking what its owner has not entered yet is premature. */
const PROMPT_NEW_VEHICLE_GRACE_DAYS = 7;
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

/**
 * The alerts that ask their reader to record something — service history, a
 * tyre reading. A viewer cannot, and no longer sees the controls to try, so
 * these go to the members who can. Every other alert is news about the vehicle
 * and goes to all of them.
 */
const EDITOR_ONLY_KINDS: ReadonlySet<AlertKind> = new Set<AlertKind>([
  'service-baseline-unknown',
  'tyre-uninspected',
]);

/** The vehicle facts the tyre checks need, kept narrow so the tests can state them. */
type TyreCheckVehicle = {
  id: string;
  userId: string;
  year: number;
  createdAt: Date;
  audience: Audience;
};

/** The vehicle facts {@link MaintenanceAlertService.raisePrompt} needs. */
type PromptVehicle = { id: string; createdAt: Date; audience: Audience };

function monthsBefore(date: Date, months: number): Date {
  const shifted = new Date(date);
  shifted.setMonth(shifted.getMonth() - months);
  return shifted;
}

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
    const baselines = new Map(vehicle.serviceBaselines.map((row) => [row.category, row]));

    for (const [category, interval] of Object.entries(intervals)) {
      if (interval.km == null) continue;
      const lastRecord = vehicle.maintenanceRecords.find((r) => r.category === category);
      const baseline = baselines.get(category as MaintenanceCategory) ?? null;

      const lastOdo = await this.resolveLastDoneOdometer({
        vehicle: { ...vehicle, audience },
        category,
        intervalKm: interval.km,
        lastRecordOdometer: lastRecord?.odometer ?? null,
        baseline,
      });
      if (lastOdo == null) continue;

      const distanceSinceLast = currentOdo - lastOdo;
      const remainingDistance = interval.km - distanceSinceLast;

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

    // 2b. A vehicle nobody has told us anything about. Raised once for the whole
    // vehicle rather than once per category, because every category is in the
    // same state and ten notifications would say one thing.
    await this.runServiceHistoryPrompt({ ...vehicle, audience }, now);

    // 3. Reminders the owner set themselves. Both timings are checked here: an
    // odometer mark the vehicle is approaching, and a due date the calendar has
    // reached. Date-only reminders — every renewal, and every month-based item
    // the service schedule produces — used to be excluded by the query and so
    // reached nobody.
    const reminders = await this.prisma.reminder.findMany({
      where: {
        vehicleId,
        status: { not: 'completed' },
        OR: [{ dueOdometer: { not: null } }, { dueDate: { not: null } }],
      },
    });

    for (const reminder of reminders) {
      // The tyre walk-around is alerted from measurements, not from this row.
      // Both would otherwise nag about one thing, and they would disagree: a
      // reminder goes overdue when nobody ticked a box, while `tyre-uninspected`
      // goes stale when nobody actually looked. Only the second is true about
      // the tyres. Someone who inspects and forgets to tick is left alone;
      // someone who ticks without inspecting is not.
      if (extractSlugFromNotes(reminder.notes) === TYRE_INSPECTION_SLUG) continue;

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
    await this.runTyreChecks({ ...vehicle, audience }, now);
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
   * The odometer a category's interval should be measured from, or null when
   * there is nothing honest to measure from and no alert should be attempted.
   *
   * The four cases are genuinely different and used to collapse into one:
   *
   * - A **logged service** is a measurement and always wins.
   * - A **baseline reading** is what the owner told us at onboarding. Second
   *   best, and the whole point of the table.
   * - A baseline of **`unknown`** is an owner who was asked and said they did
   *   not know. That earns an alert, not silence — silence is what let a bike
   *   at 40 000 km look like it had just had everything done.
   * - **No baseline row** means nobody has been asked. Every vehicle predating
   *   the baseline table is in this state, so it keeps the historical fallback
   *   (measure from the odometer on the vehicle) rather than being retroactively
   *   declared unknown and alerted about, category by category.
   *
   * A baseline that knows only a date is the fifth case and returns null: the
   * distance arithmetic here cannot use it, and inventing an odometer for that
   * date from the mileage forecast would let a projection decide a service is
   * overdue. Month-based intervals surface through the forecast, not alerts.
   */
  private async resolveLastDoneOdometer(args: {
    vehicle: { id: string; odometer: number; audience: Audience };
    category: string;
    intervalKm: number;
    lastRecordOdometer: number | null;
    baseline: { status: ServiceBaselineStatus; lastDoneOdometer: number | null } | null;
  }): Promise<number | null> {
    const { vehicle, category, intervalKm, lastRecordOdometer, baseline } = args;

    if (lastRecordOdometer != null) return lastRecordOdometer;
    if (baseline?.lastDoneOdometer != null) return baseline.lastDoneOdometer;

    if (baseline?.status === ServiceBaselineStatus.unknown) {
      await this.raiseToMembers(vehicle.audience, vehicle.id, 'service-baseline-unknown', {
        vehicleId: vehicle.id,
        odometer: vehicle.odometer,
        scope: 'category',
        category,
        intervalKm,
      });
      return null;
    }

    if (baseline) return null;

    return vehicle.odometer || 0;
  }

  /**
   * Fires only when the app has been told nothing at all: no confirmed service
   * records, no baselines, and enough distance or years for that silence to be
   * misleading. A vehicle with a single logged service is already telling us
   * something and is left alone.
   *
   * `maintenanceRecords` arrives already filtered to confirmed rows, so a
   * vehicle whose only history is an unconfirmed draft still gets asked. That
   * is the point: nobody has yet agreed the draft describes a real service.
   */
  private async runServiceHistoryPrompt(
    vehicle: PromptVehicle & {
      odometer: number;
      year: number;
      maintenanceRecords: unknown[];
      serviceBaselines: unknown[];
    },
    now: Date,
  ) {
    if (vehicle.maintenanceRecords.length > 0) return;
    if (vehicle.serviceBaselines.length > 0) return;
    if (!this.isOldEnoughToAsk(vehicle, vehicle.odometer, SERVICE_HISTORY_PROMPT_KM, now)) {
      return;
    }

    await this.raisePrompt(
      vehicle,
      'service-baseline-unknown',
      { vehicleId: vehicle.id, odometer: vehicle.odometer, scope: 'vehicle' },
      now,
    );
  }

  /**
   * Condition alerts fire per tyre; the inspection prompt fires per vehicle.
   * The resolver reports one verdict per tyre — the worse of tread and age — so
   * a tyre raises at most one of `tyre-worn` / `tyre-aged` and a set of four
   * cannot produce eight notifications in a morning.
   */
  private async runTyreChecks(vehicle: TyreCheckVehicle, now: Date) {
    const state = await this.tyresService.getAlertState(vehicle.userId, vehicle.id);

    for (const condition of state.conditions) {
      // `unknown` means nothing has been measured, which the inspection prompt
      // below answers. Calling it worn would invent a reading.
      if (condition.level === 'healthy' || condition.level === 'unknown') continue;

      if (condition.reason === 'tread') {
        await this.raiseToMembers(vehicle.audience, vehicle.id, 'tyre-worn', {
          vehicleId: vehicle.id,
          tyreId: condition.tyreId,
          position: condition.position,
          level: condition.level,
          summary: condition.summary,
          treadDepthMm: condition.treadDepthMm,
        });
      } else if (condition.reason === 'age' && condition.level !== 'illegal') {
        await this.raiseToMembers(vehicle.audience, vehicle.id, 'tyre-aged', {
          vehicleId: vehicle.id,
          tyreId: condition.tyreId,
          position: condition.position,
          level: condition.level,
          summary: condition.summary,
          ageYears: condition.ageYears,
        });
      }
    }

    await this.runTyreInspectionPrompt(vehicle, state, now);
  }

  private async runTyreInspectionPrompt(
    vehicle: TyreCheckVehicle,
    state: VehicleTyreAlertState,
    now: Date,
  ) {
    if (state.conditions.length === 0) {
      if (!this.isOldEnoughToAsk(vehicle, state.vehicleOdometer, TYRE_TRACKING_PROMPT_KM, now)) {
        return;
      }

      await this.raisePrompt(
        vehicle,
        'tyre-uninspected',
        { vehicleId: vehicle.id, odometer: state.vehicleOdometer, reason: 'untracked' },
        now,
      );
      return;
    }

    // Tyres are tracked but none of them is on the road (a lone spare). There is
    // no distance to measure staleness against and nothing useful to ask for.
    if (state.lastObservation == null) return;

    const kmSinceLastCheck = Math.max(0, state.vehicleOdometer - state.lastObservation.odometer);
    const staleByDistance = kmSinceLastCheck >= TYRE_INSPECTION_INTERVAL_KM;
    const staleByTime =
      state.lastObservation.at <= monthsBefore(now, TYRE_INSPECTION_INTERVAL_MONTHS);
    if (!staleByDistance && !staleByTime) return;

    const daysSinceLastCheck = Math.max(
      0,
      Math.floor((now.getTime() - state.lastObservation.at.getTime()) / MS_PER_DAY),
    );

    await this.raiseToMembers(vehicle.audience, vehicle.id, 'tyre-uninspected', {
      vehicleId: vehicle.id,
      odometer: state.vehicleOdometer,
      reason: 'stale',
      kmSinceLastCheck,
      daysSinceLastCheck,
    });
  }

  /**
   * Raise one of the two cold-start prompts, politely.
   *
   * Three rules, none of which touch the condition alerts (`tyre-worn`,
   * `tyre-aged`, the category-scope baseline) — those describe something true
   * about the vehicle and go out regardless:
   *
   * - A vehicle added in the last week is still being set up. Asking its owner
   *   about tyres or service history they may be about to enter is noise, so
   *   nothing is raised at all.
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
    vehicle: PromptVehicle,
    kind: K,
    payload: AlertPayloads[K],
    now: Date,
  ) {
    if (vehicle.createdAt > daysBefore(now, PROMPT_NEW_VEHICLE_GRACE_DAYS)) return;

    for (const userId of this.recipientsFor(vehicle.audience, kind)) {
      await this.notifyService.raise(userId, vehicle.id, kind, payload, {
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
   * Whether a vehicle has enough history behind it for the app's silence about
   * that history to be misleading — enough distance covered, or old enough that
   * wear items have aged regardless of use. Below both, a vehicle really is
   * young and original and asking is noise.
   *
   * The distance threshold differs per question (tyres and service history are
   * not due at the same point); the age one does not, because it is the same
   * observation in both cases: the calendar wears a vehicle that never moves.
   */
  private isOldEnoughToAsk(
    vehicle: { year: number },
    odometer: number,
    promptKm: number,
    now: Date,
  ): boolean {
    const vehicleAgeYears = now.getFullYear() - vehicle.year;
    return odometer >= promptKm || vehicleAgeYears >= VEHICLE_AGE_PROMPT_YEARS;
  }

  /**
   * Trigger checks for ALL vehicles.
   * This is called automatically every day at 6:00 AM.
   */
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

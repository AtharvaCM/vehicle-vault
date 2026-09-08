import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
// The Prisma enum rather than the shared one: these rows come straight off the
// vehicle include, and re-casting them to the wire enum would be ceremony over
// two identical string unions.
import { ServiceBaselineStatus } from '@prisma/client';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { AccessoriesService } from '../accessories/accessories.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { TyresService, type VehicleTyreAlertState } from '../tyres/tyres.service';
import {
  ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS,
  SERVICE_HISTORY_PROMPT_KM,
  TYRE_INSPECTION_INTERVAL_KM,
  TYRE_INSPECTION_INTERVAL_MONTHS,
  TYRE_TRACKING_PROMPT_KM,
  VEHICLE_AGE_PROMPT_YEARS,
  type MaintenanceCategory,
} from '@vehicle-vault/shared';

const DOCUMENT_EXPIRY_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The vehicle facts the tyre checks need, kept narrow so the tests can state them. */
type TyreCheckVehicle = { id: string; userId: string; year: number };

function monthsBefore(date: Date, months: number): Date {
  const shifted = new Date(date);
  shifted.setMonth(shifted.getMonth() - months);
  return shifted;
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
          orderBy: { odometer: 'desc' },
        },
        // Loaded with the vehicle rather than fetched per category: this runs
        // once per vehicle in a loop over every vehicle in the database, and a
        // baseline is a small child row of the vehicle already being read.
        serviceBaselines: true,
      },
    });

    if (!vehicle) return;

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
        vehicle,
        category,
        intervalKm: interval.km,
        lastRecordOdometer: lastRecord?.odometer ?? null,
        baseline,
      });
      if (lastOdo == null) continue;

      const distanceSinceLast = currentOdo - lastOdo;
      const remainingDistance = interval.km - distanceSinceLast;

      // Alert if due within 500km or already overdue
      if (remainingDistance <= 500) {
        const kind = remainingDistance < 0 ? 'maintenance-overdue' : 'maintenance-due';
        await this.notifyService.raise(vehicle.userId, vehicle.id, kind, {
          vehicleId: vehicle.id,
          category,
          remainingDistanceKm: remainingDistance,
        });
      }
    }

    // 2b. A vehicle nobody has told us anything about. Raised once for the whole
    // vehicle rather than once per category, because every category is in the
    // same state and ten notifications would say one thing.
    await this.runServiceHistoryPrompt(vehicle, new Date());

    // 3. Check specific Reminders with dueOdometer
    const reminders = await this.prisma.reminder.findMany({
      where: {
        vehicleId,
        status: { not: 'completed' },
        dueOdometer: { not: null },
      },
    });

    for (const reminder of reminders) {
      if (!reminder.dueOdometer) continue;

      const remainingDistance = reminder.dueOdometer - currentOdo;

      // Alert if due within 500km or already overdue
      if (remainingDistance <= 500) {
        const kind = remainingDistance < 0 ? 'reminder-overdue' : 'reminder-due';
        await this.notifyService.raise(vehicle.userId, vehicle.id, kind, {
          reminderId: reminder.id,
          vehicleId: vehicle.id,
          title: reminder.title,
          dueOdometer: reminder.dueOdometer,
          remainingDistanceKm: remainingDistance,
        });
      }
    }

    // 4. Document expiry (insurance, warranty, future kinds).
    // Range query replaces the previous 1-day cron slice — alerts no longer
    // drop silently when the cron drifts.
    const expiring = await this.vehicleDocumentsService.findExpiring(
      vehicle.userId,
      DOCUMENT_EXPIRY_WINDOW_DAYS,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const doc of expiring) {
      if (doc.vehicleId !== vehicleId) continue;
      if (!doc.endDate) continue;
      const daysUntilExpiry = Math.max(
        0,
        Math.ceil((doc.endDate.getTime() - today.getTime()) / MS_PER_DAY),
      );
      await this.notifyService.raise(vehicle.userId, doc.vehicleId, 'document-expiring', {
        document: doc,
        daysUntilExpiry,
      });
    }

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
      await this.notifyService.raise(
        vehicle.userId,
        accessory.vehicleId,
        'accessory-warranty-expiring',
        { accessory, daysUntilExpiry },
      );
    }

    // 6. Tyres. Tread and age are the two wear limits an odometer-driven service
    // schedule cannot express — a tyre reaches the legal minimum between
    // services, and rubber ages out whether or not the vehicle moves. The
    // grading already existed for the vehicle page; without this call nothing
    // reached the user unless they went looking.
    await this.runTyreChecks(vehicle, new Date());
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
    vehicle: { id: string; userId: string; odometer: number };
    category: string;
    intervalKm: number;
    lastRecordOdometer: number | null;
    baseline: { status: ServiceBaselineStatus; lastDoneOdometer: number | null } | null;
  }): Promise<number | null> {
    const { vehicle, category, intervalKm, lastRecordOdometer, baseline } = args;

    if (lastRecordOdometer != null) return lastRecordOdometer;
    if (baseline?.lastDoneOdometer != null) return baseline.lastDoneOdometer;

    if (baseline?.status === ServiceBaselineStatus.unknown) {
      await this.notifyService.raise(vehicle.userId, vehicle.id, 'service-baseline-unknown', {
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
   * Fires only when the app has been told nothing at all: no service records, no
   * baselines, and enough distance or years for that silence to be misleading.
   * A vehicle with a single logged service is already telling us something and
   * is left alone.
   */
  private async runServiceHistoryPrompt(
    vehicle: {
      id: string;
      userId: string;
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

    await this.notifyService.raise(vehicle.userId, vehicle.id, 'service-baseline-unknown', {
      vehicleId: vehicle.id,
      odometer: vehicle.odometer,
      scope: 'vehicle',
    });
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
        await this.notifyService.raise(vehicle.userId, vehicle.id, 'tyre-worn', {
          vehicleId: vehicle.id,
          tyreId: condition.tyreId,
          position: condition.position,
          level: condition.level,
          summary: condition.summary,
          treadDepthMm: condition.treadDepthMm,
        });
      } else if (condition.reason === 'age' && condition.level !== 'illegal') {
        await this.notifyService.raise(vehicle.userId, vehicle.id, 'tyre-aged', {
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

      await this.notifyService.raise(vehicle.userId, vehicle.id, 'tyre-uninspected', {
        vehicleId: vehicle.id,
        odometer: state.vehicleOdometer,
        reason: 'untracked',
      });
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

    await this.notifyService.raise(vehicle.userId, vehicle.id, 'tyre-uninspected', {
      vehicleId: vehicle.id,
      odometer: state.vehicleOdometer,
      reason: 'stale',
      kmSinceLastCheck,
      daysSinceLastCheck,
    });
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

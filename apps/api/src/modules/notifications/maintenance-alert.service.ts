import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { AccessoriesService } from '../accessories/accessories.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceIntervalResolver } from '../vehicles/maintenance-interval.resolver';
import { ACCESSORY_WARRANTY_ALERT_WINDOW_DAYS } from '@vehicle-vault/shared';

const DOCUMENT_EXPIRY_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    for (const [category, interval] of Object.entries(intervals)) {
      if (interval.km == null) continue;
      const lastRecord = vehicle.maintenanceRecords.find((r) => r.category === category);
      const lastOdo = lastRecord ? lastRecord.odometer : vehicle.odometer || 0;

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

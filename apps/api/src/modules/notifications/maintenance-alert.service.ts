import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleDocumentsService } from '../vehicle-documents/vehicle-documents.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceCategory } from '@prisma/client';

const DOCUMENT_EXPIRY_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Smart maintenance intervals (in km)
const MAINTENANCE_INTERVALS: Partial<Record<MaintenanceCategory, number>> = {
  periodic_service: 10000,
  engine_oil: 7500,
  oil_filter: 7500,
  air_filter: 15000,
  brake_pads: 30000,
  tyre_rotation: 10000,
  wheel_alignment: 10000,
  coolant: 40000,
};

@Injectable()
export class MaintenanceAlertService {
  private readonly logger = new Logger(MaintenanceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicleInsightsService: VehicleInsightsService,
    private readonly notifyService: NotifyService,
    private readonly vehicleDocumentsService: VehicleDocumentsService,
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

    // 2. Check each category for due service
    for (const [category, interval] of Object.entries(MAINTENANCE_INTERVALS)) {
      const lastRecord = vehicle.maintenanceRecords.find((r) => r.category === category);
      const lastOdo = lastRecord ? lastRecord.odometer : vehicle.odometer || 0;

      const distanceSinceLast = currentOdo - lastOdo;
      const remainingDistance = interval - distanceSinceLast;

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

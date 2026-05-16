import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotifyService } from './notify.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceCategory } from '@prisma/client';
import { MailService } from '../../common/mail/mail.service';

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
    private readonly notificationsService: NotificationsService,
    private readonly vehicleInsightsService: VehicleInsightsService,
    private readonly mailService: MailService,
    private readonly notifyService: NotifyService,
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

    // 4. Check Insurance Policies for expiry (7-day reminder)
    // Slice 1c migrates this to NotifyService via document-expiring template.
    await this.checkInsurancePolicies(vehicle.userId, vehicleId);
  }

  private async checkInsurancePolicies(userId: string, vehicleId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const inSevenDaysStart = new Date(todayStart);
    inSevenDaysStart.setDate(todayStart.getDate() + 7);

    const inSevenDaysEnd = new Date(inSevenDaysStart);
    inSevenDaysEnd.setDate(inSevenDaysEnd.getDate() + 1);

    const policies = await this.prisma.insurancePolicy.findMany({
      where: {
        vehicleId,
        endDate: {
          gte: inSevenDaysStart,
          lt: inSevenDaysEnd,
        },
      },
      include: {
        vehicle: true,
      },
    });

    for (const policy of policies) {
      const title = `Insurance Expiring Soon (7-day reminder): ${policy.provider}`;
      const expiryDate = policy.endDate.toLocaleDateString('en-IN', {
        dateStyle: 'medium',
        timeZone: 'Asia/Kolkata',
      });

      const message = `Your insurance policy for ${policy.vehicle.make} ${policy.vehicle.model} with ${policy.provider} (Policy: ${policy.policyNumber}) is expiring in 7 days on ${expiryDate}. Please ensure you renew it in time.`;

      const notification = await this.notificationsService.create({
        userId,
        vehicleId,
        title,
        message,
        type: 'warning',
        link: `/vehicles/${vehicleId}?tab=protection`,
      });

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user && !notification.isRead) {
        await this.mailService.sendMaintenanceAlert({
          email: user.email,
          userName: user.name,
          vehicleName: `${policy.vehicle.make} ${policy.vehicle.model}`,
          alertTitle: title,
          message,
        });
      }
    }
  }


  /**
   * Trigger checks for ALL vehicles.
   * This is called automatically every day at 6:00 AM.
   */
  @Cron(process.env.MAINTENANCE_ALERT_CRON || '0 6 * * *')
  async runDailyChecks() {
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

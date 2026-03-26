import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleInsightsService } from '../vehicles/vehicle-insights.service';
import { MaintenanceCategory } from '@prisma/client';
import { MailService } from '../mail/mail.service';

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
    const insights = await this.vehicleInsightsService.getOdometerInsights(vehicle.userId, vehicleId);
    const currentOdo = insights.currentOdometerPredicted;

    // 2. Check each category for due service
    for (const [category, interval] of Object.entries(MAINTENANCE_INTERVALS)) {
      const lastRecord = vehicle.maintenanceRecords.find(r => r.category === category);
      const lastOdo = lastRecord ? lastRecord.odometer : (vehicle.odometer || 0);
      
      const distanceSinceLast = currentOdo - lastOdo;
      const remainingDistance = interval - distanceSinceLast;

      // Alert if due within 500km or already overdue
      if (remainingDistance <= 500) {
        const isOverdue = remainingDistance < 0;
        const urgency = isOverdue ? 'error' : 'warning';
        const title = isOverdue ? `Overdue Service: ${this.formatLabel(category)}` : `Service Due Soon: ${this.formatLabel(category)}`;
        const message = isOverdue
          ? `Your ${this.formatLabel(category)} is overdue by approx. ${Math.abs(Math.round(remainingDistance))} km. Please schedule service soon.`
          : `Your ${this.formatLabel(category)} is due in approx. ${Math.round(remainingDistance)} km. Time to plan a visit to the workshop.`;

        const notification = await this.notificationsService.create({
          userId: vehicle.userId,
          vehicleId: vehicle.id,
          title,
          message,
          type: urgency,
          link: `/vehicles/${vehicle.id}?tab=maintenance`,
        });

        // If it's a new notification (not deduplicated) or user preference permits, send email
        // For simplicity now, we check the unread status. 
        // If we just created it and it's unread, send a prompt email.
        const user = await this.prisma.user.findUnique({ where: { id: vehicle.userId } });
        if (user && !notification.isRead) {
          await this.mailService.sendMaintenanceAlert(
            user.email,
            user.name,
            `${vehicle.make} ${vehicle.model}`,
            title,
            message
          );
        }
      }
    }
  }

  /**
   * Trigger checks for ALL vehicles. 
   * In production, this would be a CRON job.
   */
  async runDailyChecks() {
    this.logger.log('Starting daily maintenance alert checks...');
    const vehicles = await this.prisma.vehicle.findMany({
      select: { id: true }
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

  private formatLabel(category: string) {
    return category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

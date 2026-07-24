import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceCategory, type MaintenanceSuggestion } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceIntervalResolver } from './maintenance-interval.resolver';
import { VehicleAccessService } from './vehicle-access.service';
import { VehicleInsightsService } from './vehicle-insights.service';

@Injectable()
export class MaintenanceForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: VehicleInsightsService,
    private readonly access: VehicleAccessService,
    private readonly intervalResolver: MaintenanceIntervalResolver,
  ) {}

  async getUpcomingSuggestions(userId: string, vehicleId: string): Promise<MaintenanceSuggestion[]> {
    await this.access.assert(userId, vehicleId);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, odometer: true, createdAt: true, catalogVariantId: true, make: true, model: true, vehicleType: true, fuelType: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const insights = await this.insightsService.getOdometerInsights(userId, vehicleId);
    if (insights.confidence === 'low' && insights.dataPointsCount < 2) {
      // Not enough data to make reliable forecasts based on usage
      // We could still suggest based on time since creation, but let's be conservative
      return [];
    }

    const suggestions: MaintenanceSuggestion[] = [];
    const now = new Date();

    // Intervals come from the shared resolver: per-variant catalog data when
    // linked, type/fuel-gated defaults otherwise.
    const intervalsToCheck = await this.intervalResolver.resolveForVehicle(vehicle);

    // For each category, find the latest record and evaluate
    for (const [category, interval] of Object.entries(intervalsToCheck)) {
      const latestRecord = await this.prisma.maintenanceRecord.findFirst({
        where: { vehicleId, category: category as MaintenanceCategory },
        orderBy: { serviceDate: 'desc' },
      });

      const lastOdo = latestRecord?.odometer ?? vehicle.odometer;
      const lastDate = latestRecord?.serviceDate ?? vehicle.createdAt;

      const kmSinceLast = insights.currentOdometerPredicted - lastOdo;
      const monthsSinceLast = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      const odoProgress = interval.km != null ? kmSinceLast / interval.km : 0;
      const timeProgress = interval.months != null ? monthsSinceLast / interval.months : 0;

      const maxProgress = Math.max(odoProgress, timeProgress);

      if (maxProgress >= 0.8) {
        const priority = maxProgress >= 1.0 ? 'high' : maxProgress >= 0.9 ? 'medium' : 'low';

        let reason = '';
        if (odoProgress >= timeProgress && interval.km != null) {
          reason = `Last ${category.replace('_', ' ')} was ${Math.round(kmSinceLast)}km ago. Recommended every ${interval.km}km.`;
        } else {
          reason = `Last ${category.replace('_', ' ')} was ${Math.round(monthsSinceLast)} months ago. Recommended every ${interval.months} months.`;
        }

        suggestions.push({
          category: category as MaintenanceCategory,
          reason,
          priority,
          estimatedOdometerDue: interval.km != null ? lastOdo + interval.km : undefined,
          estimatedDateDue:
            interval.months != null
              ? new Date(lastDate.getTime() + interval.months * 30.44 * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          vehicleId,
          vehicleLabel: `${vehicle.make} ${vehicle.model}`,
        });
      }
    }

    return suggestions.sort((a, b) => {
      const priorities = { high: 0, medium: 1, low: 2 };
      return priorities[a.priority] - priorities[b.priority];
    });
  }
}

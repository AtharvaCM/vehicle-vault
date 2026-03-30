import { Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceCategory, type MaintenanceSuggestion } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { VehicleInsightsService } from './vehicle-insights.service';

interface ServiceInterval {
  km: number;
  months: number;
}

const DEFAULT_INTERVALS: Partial<Record<MaintenanceCategory, ServiceInterval>> = {
  [MaintenanceCategory.EngineOil]: { km: 7500, months: 6 },
  [MaintenanceCategory.PeriodicService]: { km: 10000, months: 12 },
  [MaintenanceCategory.BrakePads]: { km: 30000, months: 24 },
  [MaintenanceCategory.TyreRotation]: { km: 10000, months: 12 },
  [MaintenanceCategory.AirFilter]: { km: 15000, months: 12 },
  [MaintenanceCategory.Coolant]: { km: 30000, months: 24 },
  [MaintenanceCategory.ChainService]: { km: 500, months: 1 }, // Short for motorcycles
};

@Injectable()
export class MaintenanceForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightsService: VehicleInsightsService,
  ) {}

  async getUpcomingSuggestions(userId: string, vehicleId: string): Promise<MaintenanceSuggestion[]> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { id: true, odometer: true, createdAt: true, catalogVariantId: true, make: true, model: true },
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

    // 1. Fetch catalog-specific intervals if available
    const catalogIntervals = vehicle.catalogVariantId
      ? await this.prisma.serviceInterval.findMany({
          where: { variantId: vehicle.catalogVariantId },
        })
      : [];

    // 2. Build the final intervals to check, starting with defaults
    const intervalsToCheck: Record<MaintenanceCategory, ServiceInterval> = {
      ...(DEFAULT_INTERVALS as Record<MaintenanceCategory, ServiceInterval>),
    };

    // Override with catalog-specific ones
    for (const ci of catalogIntervals) {
      if (ci.intervalKm || ci.intervalMonths) {
        intervalsToCheck[ci.category as MaintenanceCategory] = {
          km: ci.intervalKm ?? 999999, // default to large if null
          months: ci.intervalMonths ?? 999,
        };
      }
    }

    // 3. For each category, find the latest record and evaluate
    for (const [category, interval] of Object.entries(intervalsToCheck)) {
      const latestRecord = await this.prisma.maintenanceRecord.findFirst({
        where: { vehicleId, category: category as MaintenanceCategory },
        orderBy: { serviceDate: 'desc' },
      });

      const lastOdo = latestRecord?.odometer ?? vehicle.odometer;
      const lastDate = latestRecord?.serviceDate ?? vehicle.createdAt;

      const kmSinceLast = insights.currentOdometerPredicted - lastOdo;
      const monthsSinceLast = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      const odoProgress = kmSinceLast / interval.km;
      const timeProgress = monthsSinceLast / interval.months;

      const maxProgress = Math.max(odoProgress, timeProgress);

      if (maxProgress >= 0.8) {
        const priority = maxProgress >= 1.0 ? 'high' : maxProgress >= 0.9 ? 'medium' : 'low';
        
        let reason = '';
        if (odoProgress >= timeProgress) {
          reason = `Last ${category.replace('_', ' ')} was ${Math.round(kmSinceLast)}km ago. Recommended every ${interval.km}km.`;
        } else {
          reason = `Last ${category.replace('_', ' ')} was ${Math.round(monthsSinceLast)} months ago. Recommended every ${interval.months} months.`;
        }

        suggestions.push({
          category: category as MaintenanceCategory,
          reason,
          priority,
          estimatedOdometerDue: lastOdo + interval.km,
          estimatedDateDue: new Date(lastDate.getTime() + interval.months * 30.44 * 24 * 60 * 60 * 1000).toISOString(),
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

import { Injectable, NotFoundException } from '@nestjs/common';
import type { FuelType, VehicleFuelEconomy } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { computeFuelEconomy } from './fuel-economy';
import { VehicleAccessService } from './vehicle-access.service';

export interface VehicleOdometerInsight {
  averageDailyMileage: number;
  averageMonthlyMileage: number;
  currentOdometerPredicted: number;
  lastRecordedOdometer: number;
  lastRecordedDate: string;
  daysSinceLastReading: number;
  dataPointsCount: number;
  confidence: 'low' | 'medium' | 'high';
}

@Injectable()
export class VehicleInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: VehicleAccessService,
  ) {}

  /**
   * Real economy from the vehicle's own fuel logs, beside what its catalog
   * variant claims. The claim comes from the variant the vehicle is linked to,
   * so a vehicle linked only to a generation, or not at all, shows its achieved
   * figure on its own. See computeFuelEconomy for how the figure is measured.
   */
  async getFuelEconomy(userId: string, vehicleId: string): Promise<VehicleFuelEconomy> {
    await this.access.assert(userId, vehicleId);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { fuelType: true, catalogVariantId: true },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} was not found`);
    }

    const [fills, spec] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where: { vehicleId },
        select: { odometer: true, quantity: true, date: true },
      }),
      vehicle.catalogVariantId
        ? this.prisma.vehicleCatalogVariantSpec.findUnique({
            where: { variantId: vehicle.catalogVariantId },
            select: { mileageCombined: true },
          })
        : null,
    ]);

    return computeFuelEconomy(fills, vehicle.fuelType as FuelType, spec?.mileageCombined ?? null);
  }

  async getOdometerInsights(userId: string, vehicleId: string): Promise<VehicleOdometerInsight> {
    await this.access.assert(userId, vehicleId);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { odometer: true, createdAt: true, updatedAt: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    // Get all odometer readings from maintenance and fuel logs.
    //
    // Deliberately not filtered to confirmed records, unlike the alert engine,
    // the reports, and analytics. This asks how fast the vehicle accumulates
    // kilometres, not whether a service happened, and a draft's odometer is a
    // real reading taken on a real date either way — the vehicle's own reading
    // when the draft was opened, or the figure printed on the invoice being
    // extracted. Dropping it would throw away evidence about mileage to punish
    // a row for saying nothing about mileage. Readings that are actually
    // unknown are excluded below by the `odometer > 0` filter, which is the
    // check this regression cares about.
    const [maintenanceRecords, fuelLogs] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where: { vehicleId },
        select: { serviceDate: true, odometer: true },
        orderBy: { serviceDate: 'asc' },
      }),
      this.prisma.fuelLog.findMany({
        where: { vehicleId },
        select: { date: true, odometer: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Combine and sort all readings. Entries with odometer <= 0 are treated as
    // "unknown" placeholders (user didn't record the reading) and excluded so
    // they don't poison the regression / last-reading lookup.
    const logged = [
      ...maintenanceRecords.map((r) => ({ date: r.serviceDate, odometer: r.odometer })),
      ...fuelLogs.map((f) => ({ date: f.date, odometer: f.odometer })),
    ].filter((r) => r.odometer > 0);

    // The odometer on the vehicle itself is a reading too, dated by the
    // vehicle's last update (the "updated ago" the dashboard shows beside it).
    // It only counts when it is ahead of every logged reading: when it merely
    // equals one, it is that fill or service pushed onto the vehicle, and
    // dating it "now" would invent days of standing still.
    const loggedMax = logged.reduce((max, r) => Math.max(max, r.odometer), 0);
    const readings = [
      ...logged,
      ...(vehicle.odometer > loggedMax
        ? [{ date: vehicle.updatedAt, odometer: vehicle.odometer }]
        : []),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    // If no readings, return baseline using vehicle creation date
    if (readings.length === 0) {
      return {
        averageDailyMileage: 0,
        averageMonthlyMileage: 0,
        currentOdometerPredicted: vehicle.odometer,
        lastRecordedOdometer: vehicle.odometer,
        lastRecordedDate: vehicle.createdAt.toISOString(),
        daysSinceLastReading: Math.floor(
          (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
        dataPointsCount: 0,
        confidence: 'low',
      };
    }

    const firstReading = readings[0];
    const lastReading = readings[readings.length - 1];

    if (!firstReading || !lastReading) {
      // Fallback if something went wrong with the logic above
      throw new Error('Unexpected empty readings after check');
    }

    // The highest reading is what the vehicle is known to have covered, and the
    // prediction counts on from it. In consistent data it is also the latest;
    // when a later-dated entry reads lower (a typo, a back-dated fill), the
    // odometer cannot have gone backwards, so the highest one still wins.
    const known = readings.reduce((best, r) =>
      r.odometer > best.odometer || (r.odometer === best.odometer && r.date > best.date) ? r : best,
    );

    const totalDistance = lastReading.odometer - firstReading.odometer;
    const totalDays = Math.max(
      1,
      Math.floor(
        (lastReading.date.getTime() - firstReading.date.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    // One reading has no rate; neither does a set whose latest entry reads
    // lower than its first.
    const averageDailyMileage = readings.length < 2 ? 0 : Math.max(0, totalDistance / totalDays);
    const daysSinceLastReading = Math.max(
      0,
      Math.floor((Date.now() - known.date.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const predictedCurrentOdometer = Math.round(
      known.odometer + daysSinceLastReading * averageDailyMileage,
    );

    return {
      averageDailyMileage: Math.round(averageDailyMileage * 10) / 10,
      averageMonthlyMileage: Math.round(averageDailyMileage * 30.44),
      currentOdometerPredicted: predictedCurrentOdometer,
      lastRecordedOdometer: known.odometer,
      lastRecordedDate: known.date.toISOString(),
      daysSinceLastReading,
      dataPointsCount: readings.length,
      confidence: readings.length > 5 ? 'high' : readings.length > 2 ? 'medium' : 'low',
    };
  }
}

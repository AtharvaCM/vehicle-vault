import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async getOdometerInsights(userId: string, vehicleId: string): Promise<VehicleOdometerInsight> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { odometer: true, createdAt: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    // Get all odometer readings from maintenance and fuel logs
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

    // Combine and sort all readings
    const readings = [
      ...maintenanceRecords.map((r) => ({ date: r.serviceDate, odometer: r.odometer })),
      ...fuelLogs.map((f) => ({ date: f.date, odometer: f.odometer })),
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

    const totalDistance = lastReading.odometer - firstReading.odometer;
    const totalDays = Math.max(
      1,
      Math.floor(
        (lastReading.date.getTime() - firstReading.date.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const averageDailyMileage = totalDistance / totalDays;
    const daysSinceLastReading = Math.floor(
      (Date.now() - lastReading.date.getTime()) / (1000 * 60 * 60 * 24),
    );

    const predictedCurrentOdometer = Math.round(
      lastReading.odometer + Math.max(0, daysSinceLastReading * averageDailyMileage),
    );

    return {
      averageDailyMileage: Math.round(averageDailyMileage * 10) / 10,
      averageMonthlyMileage: Math.round(averageDailyMileage * 30.44),
      currentOdometerPredicted: predictedCurrentOdometer,
      lastRecordedOdometer: lastReading.odometer,
      lastRecordedDate: lastReading.date.toISOString(),
      daysSinceLastReading,
      dataPointsCount: readings.length,
      confidence: readings.length > 5 ? 'high' : readings.length > 2 ? 'medium' : 'low',
    };
  }
}

import { Injectable } from '@nestjs/common';
import { FuelType, MaintenanceCategory, VehicleType } from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface ResolvedInterval {
  /** Kilometres between services; null when only time-based. */
  km: number | null;
  /** Months between services; null when only distance-based. */
  months: number | null;
  /** Where the interval came from — per-variant catalog data or the default table. */
  source: 'variant' | 'default';
}

export type ResolvedIntervalMap = Partial<Record<MaintenanceCategory, ResolvedInterval>>;

/**
 * The single source of truth for "how often does this vehicle need X".
 *
 * Replaces three divergent copies (the alert engine's hardcoded km map, the
 * forecast service's DEFAULT_INTERVALS, and per-variant ServiceInterval
 * merge logic). Resolution order per category:
 *
 *   1. Per-variant `ServiceInterval` row when the vehicle is linked to a
 *      catalog variant — the point of the catalog investment.
 *   2. The conservative defaults below, gated by vehicle type and fuel so
 *      EVs don't get oil-change alerts and cars don't get chain-lube ones.
 */
const DEFAULT_INTERVALS: ResolvedIntervalMap = {
  [MaintenanceCategory.PeriodicService]: { km: 10000, months: 12, source: 'default' },
  [MaintenanceCategory.EngineOil]: { km: 7500, months: 6, source: 'default' },
  [MaintenanceCategory.OilFilter]: { km: 7500, months: 6, source: 'default' },
  [MaintenanceCategory.AirFilter]: { km: 15000, months: 12, source: 'default' },
  [MaintenanceCategory.BrakePads]: { km: 30000, months: 24, source: 'default' },
  [MaintenanceCategory.TyreRotation]: { km: 10000, months: 12, source: 'default' },
  [MaintenanceCategory.WheelAlignment]: { km: 10000, months: 12, source: 'default' },
  [MaintenanceCategory.Coolant]: { km: 40000, months: 24, source: 'default' },
  [MaintenanceCategory.ChainService]: { km: 500, months: 1, source: 'default' },
  [MaintenanceCategory.TimingBelt]: { km: 120000, months: 60, source: 'default' },
};

const MOTORCYCLE_ONLY = new Set<MaintenanceCategory>([MaintenanceCategory.ChainService]);

const NON_MOTORCYCLE_ONLY = new Set<MaintenanceCategory>([MaintenanceCategory.TimingBelt]);

/** Combustion-engine service items that never apply to a pure EV. */
const NOT_FOR_ELECTRIC = new Set<MaintenanceCategory>([
  MaintenanceCategory.EngineOil,
  MaintenanceCategory.OilFilter,
  MaintenanceCategory.AirFilter,
  MaintenanceCategory.Coolant,
  MaintenanceCategory.TimingBelt,
]);

export interface IntervalVehicleShape {
  catalogVariantId: string | null | undefined;
  vehicleType: string;
  fuelType: string;
}

@Injectable()
export class MaintenanceIntervalResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForVehicle(vehicle: IntervalVehicleShape): Promise<ResolvedIntervalMap> {
    const resolved: ResolvedIntervalMap = {};

    for (const [category, interval] of Object.entries(DEFAULT_INTERVALS)) {
      if (this.appliesTo(category as MaintenanceCategory, vehicle)) {
        resolved[category as MaintenanceCategory] = interval;
      }
    }

    if (vehicle.catalogVariantId) {
      const rows = await this.prisma.serviceInterval.findMany({
        where: { variantId: vehicle.catalogVariantId },
      });
      for (const row of rows) {
        if (row.intervalKm == null && row.intervalMonths == null) continue;
        const category = row.category as MaintenanceCategory;
        if (!this.appliesTo(category, vehicle)) continue;
        resolved[category] = {
          km: row.intervalKm,
          months: row.intervalMonths,
          source: 'variant',
        };
      }
    }

    return resolved;
  }

  private appliesTo(category: MaintenanceCategory, vehicle: IntervalVehicleShape): boolean {
    const isMotorcycle = vehicle.vehicleType === VehicleType.Motorcycle;
    if (MOTORCYCLE_ONLY.has(category) && !isMotorcycle) return false;
    if (NON_MOTORCYCLE_ONLY.has(category) && isMotorcycle) return false;
    if (vehicle.fuelType === FuelType.Electric && NOT_FOR_ELECTRIC.has(category)) return false;
    return true;
  }
}

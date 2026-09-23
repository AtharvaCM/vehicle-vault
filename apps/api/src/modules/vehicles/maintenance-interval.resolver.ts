import { Injectable } from '@nestjs/common';
import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type VehicleServiceInterval,
  type VehicleServiceIntervalMap,
} from '@vehicle-vault/shared';

import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The shape is defined in `@vehicle-vault/shared` because it crosses the wire —
 * these aliases keep the existing internal names working.
 */
export type ResolvedInterval = VehicleServiceInterval;
export type ResolvedIntervalMap = VehicleServiceIntervalMap;

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
 *
 * Two-wheelers (motorcycles and scooters — `VehicleType.Motorcycle` covers
 * both; there is no separate scooter type) get their own default table
 * instead of the four-wheeler one: no tyre rotation or wheel alignment (a
 * workshop doesn't "rotate" two tyres), no timing belt, and chain service /
 * coolant are further gated on the variant's recorded drivetrain, not on
 * vehicle type alone — see `appliesTo`.
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
  [MaintenanceCategory.TimingBelt]: { km: 120000, months: 60, source: 'default' },
};

/**
 * Two-wheeler defaults, researched from Indian manufacturer service
 * schedules (owner manuals / official service-schedule pages) rather than
 * carried over from the four-wheeler table — see the PR description for the
 * table and sources. `ChainService` and `Coolant` are further gated by the
 * variant's recorded drive/cooling type in `appliesTo`; when that fact isn't
 * recorded the item is left out rather than guessed.
 */
const TWO_WHEELER_DEFAULT_INTERVALS: ResolvedIntervalMap = {
  [MaintenanceCategory.PeriodicService]: { km: 3000, months: 6, source: 'default' },
  [MaintenanceCategory.EngineOil]: { km: 3000, months: 4, source: 'default' },
  [MaintenanceCategory.AirFilter]: { km: 8000, months: 12, source: 'default' },
  [MaintenanceCategory.BrakePads]: { km: 10000, months: 12, source: 'default' },
  [MaintenanceCategory.ChainService]: { km: 500, months: 1, source: 'default' },
  [MaintenanceCategory.Coolant]: { km: 20000, months: 24, source: 'default' },
};

const NON_MOTORCYCLE_ONLY = new Set<MaintenanceCategory>([
  MaintenanceCategory.TimingBelt,
  MaintenanceCategory.TyreRotation,
  MaintenanceCategory.WheelAlignment,
]);

/**
 * Combustion-engine service items that never apply to a pure EV. Chain
 * service is deliberately not here — an electric motorcycle's chain still
 * wears whether or not it has an engine.
 */
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

export interface IntervalVariantShape {
  variantId: string | null;
  vehicleType: string;
  fuelType: string;
}

/**
 * The catalog spec facts the two-wheeler gating needs, read straight off
 * `VehicleCatalogVariantSpec`. Free text as the catalog/scrapers record it
 * (e.g. "chain", "liquid-cooled") — matched with loose substring checks
 * rather than parsed into an enum, since the source data isn't normalized.
 *
 * `transmission` isn't read yet: CVT-belt gating needs a `MaintenanceCategory`
 * this table doesn't have (see the PR description's follow-ups), so the
 * two-wheeler table has no item that would use it. Selected here so it's a
 * one-line addition once that category exists.
 */
interface TwoWheelerSpecFacts {
  transmission: string | null;
  driveType: string | null;
  coolingType: string | null;
}

const EMPTY_SPEC_FACTS: TwoWheelerSpecFacts = {
  transmission: null,
  driveType: null,
  coolingType: null,
};

/** Chain final drive, going by the variant's recorded drive type. Never guessed from transmission. */
function isChainDrive(driveType: string | null): boolean {
  return driveType != null && /chain/i.test(driveType);
}

/** Liquid-cooled, going by the variant's recorded cooling type. */
function isLiquidCooled(coolingType: string | null): boolean {
  return coolingType != null && /liquid/i.test(coolingType);
}

@Injectable()
export class MaintenanceIntervalResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForVehicle(vehicle: IntervalVehicleShape): Promise<ResolvedIntervalMap> {
    return this.resolveForVariant({
      variantId: vehicle.catalogVariantId ?? null,
      vehicleType: vehicle.vehicleType,
      fuelType: vehicle.fuelType,
    });
  }

  /**
   * The same resolution without a vehicle: what a catalog variant needs, for a
   * given type and fuel. The public catalog pages read this, so a stranger sees
   * the schedule a tracked vehicle of that variant would be held to.
   */
  async resolveForVariant(variant: IntervalVariantShape): Promise<ResolvedIntervalMap> {
    const resolved: ResolvedIntervalMap = {};
    const isMotorcycle = variant.vehicleType === VehicleType.Motorcycle;
    // Only two-wheelers need the drive/cooling facts, and only when linked to
    // a catalog variant — one extra lookup, skipped entirely for cars.
    const specFacts = isMotorcycle
      ? await this.twoWheelerSpecFacts(variant.variantId)
      : EMPTY_SPEC_FACTS;
    const defaults = isMotorcycle ? TWO_WHEELER_DEFAULT_INTERVALS : DEFAULT_INTERVALS;

    for (const [category, interval] of Object.entries(defaults)) {
      if (this.appliesTo(category as MaintenanceCategory, variant, specFacts)) {
        resolved[category as MaintenanceCategory] = interval;
      }
    }

    if (variant.variantId) {
      const rows = await this.prisma.serviceInterval.findMany({
        where: { variantId: variant.variantId },
      });
      for (const row of rows) {
        if (row.intervalKm == null && row.intervalMonths == null) continue;
        const category = row.category as MaintenanceCategory;
        if (!this.appliesTo(category, variant, specFacts)) continue;
        // A variant row replaces the default outright rather than merging with
        // it, so a manufacturer can express a genuinely time-only or
        // distance-only interval. A null here means "no limit on this
        // dimension", not "unspecified" — the two are indistinguishable in the
        // schema, and this reading is the one the seed data is written against.
        resolved[category] = {
          km: row.intervalKm,
          months: row.intervalMonths,
          source: 'variant',
        };
      }
    }

    return resolved;
  }

  private async twoWheelerSpecFacts(variantId: string | null): Promise<TwoWheelerSpecFacts> {
    if (!variantId) return EMPTY_SPEC_FACTS;
    const spec = await this.prisma.vehicleCatalogVariantSpec.findUnique({
      where: { variantId },
      select: { transmission: true, driveType: true, coolingType: true },
    });
    return spec ?? EMPTY_SPEC_FACTS;
  }

  private appliesTo(
    category: MaintenanceCategory,
    vehicle: Pick<IntervalVehicleShape, 'vehicleType' | 'fuelType'>,
    specFacts: TwoWheelerSpecFacts,
  ): boolean {
    const isMotorcycle = vehicle.vehicleType === VehicleType.Motorcycle;
    if (NON_MOTORCYCLE_ONLY.has(category) && isMotorcycle) return false;
    if (vehicle.fuelType === FuelType.Electric && NOT_FOR_ELECTRIC.has(category)) return false;

    // Chain service and coolant are never guessed: without a recorded drive
    // or cooling type, they're left out rather than shown on the strength of
    // "most two-wheelers are chain-driven" or "most are air-cooled".
    if (category === MaintenanceCategory.ChainService) {
      return isMotorcycle && isChainDrive(specFacts.driveType);
    }
    if (category === MaintenanceCategory.Coolant && isMotorcycle) {
      return isLiquidCooled(specFacts.coolingType);
    }

    return true;
  }
}

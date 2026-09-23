import type { FuelType } from '../enums/fuel-type.enum';
import type { MaintenanceCategory } from '../enums/maintenance-category.enum';
import { VehicleType } from '../enums/vehicle-type.enum';
import type { VehicleServiceInterval } from './maintenance';

/**
 * The first path segment of a public catalog page. Cars, SUVs and vans share
 * `/cars`; motorcycles live under `/bikes`. Trucks and `other` get no public
 * pages.
 */
export type PublicCatalogSegment = 'cars' | 'bikes';

export const PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES: Record<PublicCatalogSegment, VehicleType[]> = {
  cars: [VehicleType.Car, VehicleType.SUV, VehicleType.Van],
  bikes: [VehicleType.Motorcycle],
};

export function isPublicCatalogSegment(value: string): value is PublicCatalogSegment {
  return value === 'cars' || value === 'bikes';
}

/**
 * The spec fields a public page may show. An allow-list of plain facts: no
 * free-text feature lists, nothing about where a figure came from. Every field
 * is optional in the data, and a page leaves out what is missing.
 */
export interface PublicCatalogSpec {
  engineCc: number | null;
  engineCyl: number | null;
  engineType: string | null;
  engineFuel: string | null;
  powerPs: number | null;
  powerRpm: number | null;
  torqueNm: number | null;
  torqueRpm: number | null;
  transmission: string | null;
  driveType: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  kerbWeightKg: number | null;
  bootSpaceLitres: number | null;
  groundClearanceMm: number | null;
  topSpeedKph: number | null;
  mileageCity: number | null;
  mileageHighway: number | null;
  mileageCombined: number | null;
  fuelCapLitres: number | null;
  seatingCapacity: number | null;
  bodyType: string | null;
  doors: number | null;
  tyreSize: string | null;
  wheelSizeInch: number | null;
  airbagCount: number | null;
  ncapStarsAdult: number | null;
  ncapStarsChild: number | null;
  ncapRegion: string | null;
  hasAbs: boolean | null;
  hasEsc: boolean | null;
  batteryKwh: number | null;
  rangeKm: number | null;
  motorKw: number | null;
  acChargeKw: number | null;
  dcFastChargeKw: number | null;
  chargeTime0To80Min: number | null;
  gearCount: number | null;
  coolingType: string | null;
  seatHeightMm: number | null;
  brakeFrontType: string | null;
  brakeRearType: string | null;
  absChannels: number | null;
}

export interface PublicCatalogScheduleItem extends VehicleServiceInterval {
  category: MaintenanceCategory;
}

/**
 * `variant` when any interval comes from the variant's own rows — "this
 * variant's schedule". Otherwise every item is the type- and fuel-gated default
 * table, and the page says it is a typical schedule.
 */
export type PublicCatalogScheduleBasis = 'variant' | 'typical';

export interface PublicCatalogSchedule {
  basis: PublicCatalogScheduleBasis;
  /** The fuel the schedule was resolved for; an EV is never given an oil change. */
  fuelType: FuelType;
  vehicleType: VehicleType;
  items: PublicCatalogScheduleItem[];
}

export interface PublicCatalogOffering {
  fuelTypes: FuelType[];
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
}

/** What the running-cost calculator starts from. */
export interface PublicCatalogCalculatorSeed {
  fuelType: FuelType;
  /** Claimed km/L (km/kg for CNG); null when the catalog has no figure. */
  claimedMileage: number | null;
  /** Claimed range in km, for an EV. */
  claimedRangeKm: number | null;
  batteryKwh: number | null;
}

export interface PublicCatalogNamedSlug {
  name: string;
  slug: string;
}

export interface PublicCatalogVariantPage {
  segment: PublicCatalogSegment;
  vehicleType: VehicleType;
  make: PublicCatalogNamedSlug;
  model: PublicCatalogNamedSlug;
  generation: PublicCatalogNamedSlug & {
    yearStart: number | null;
    yearEnd: number | null;
    isCurrent: boolean;
  };
  variant: PublicCatalogNamedSlug;
  /** Newest first. */
  offerings: PublicCatalogOffering[];
  specs: PublicCatalogSpec | null;
  schedule: PublicCatalogSchedule;
  calculatorSeed: PublicCatalogCalculatorSeed;
  /** ISO timestamp of the newest change to the variant, its offerings or specs. */
  updatedAt: string;
}

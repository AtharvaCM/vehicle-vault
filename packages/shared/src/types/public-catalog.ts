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
  /**
   * What the page-quality gate says: the page has enough facts to be worth a
   * search engine's time. The web build's indexing flag still has the last
   * word; with it off, every page is `noindex` whatever this says.
   */
  indexable: boolean;
  /** ISO timestamp of the newest change to the variant, its offerings or specs. */
  updatedAt: string;
}

/** The public segment a vehicle type is listed under, or null for types with no public pages. */
export function publicCatalogSegmentFor(vehicleType: VehicleType): PublicCatalogSegment | null {
  for (const [segment, vehicleTypes] of Object.entries(PUBLIC_CATALOG_SEGMENT_VEHICLE_TYPES)) {
    if (vehicleTypes.includes(vehicleType)) return segment as PublicCatalogSegment;
  }
  return null;
}

/**
 * One publishable variant in the catalog index: enough to build its URL and
 * breadcrumbs, and to date it, without its page payload.
 */
export interface PublicCatalogIndexEntry {
  segment: PublicCatalogSegment;
  vehicleType: VehicleType;
  make: PublicCatalogNamedSlug;
  model: PublicCatalogNamedSlug;
  generation: PublicCatalogNamedSlug;
  variant: PublicCatalogNamedSlug;
  /** The page-quality gate's verdict, the same one the variant's page payload carries. */
  indexable: boolean;
  /** ISO timestamp of the newest change to the variant, its offerings or specs. */
  updatedAt: string;
}

/**
 * Every publishable make → model → generation → variant, flat, in one response.
 * It is what the build-time prerender walks, so it is never paginated.
 */
export interface PublicCatalogIndex {
  variants: PublicCatalogIndexEntry[];
}

/**
 * The most variant page payloads one bulk request returns. The prerender reads
 * every page at build time; one request per variant would run into the public
 * catalog rate limit long before the catalog ran out.
 */
export const PUBLIC_CATALOG_VARIANT_PAGE_BATCH_MAX = 200;

/** One page of variant page payloads, in the same order as the index. */
export interface PublicCatalogVariantPageBatch {
  items: PublicCatalogVariantPage[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

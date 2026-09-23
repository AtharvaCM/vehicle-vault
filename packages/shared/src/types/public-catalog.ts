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
 * breadcrumbs, to date it, and to sum it up on a make page, without its page
 * payload.
 */
export interface PublicCatalogIndexEntry {
  segment: PublicCatalogSegment;
  vehicleType: VehicleType;
  make: PublicCatalogNamedSlug;
  model: PublicCatalogNamedSlug;
  generation: PublicCatalogNamedSlug;
  variant: PublicCatalogNamedSlug;
  /** Every fuel it was offered with, its newest offering's first. */
  fuelTypes: FuelType[];
  /** The first year of its earliest offering. */
  yearStart: number | null;
  /** The last year of its latest offering; null while any offering is on sale. */
  yearEnd: number | null;
  /** Any of its offerings is on sale now. */
  isCurrent: boolean;
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

/**
 * One variant as a model page lists it: enough to tell it from its siblings and
 * link to its own page, which has everything else.
 */
export interface PublicCatalogModelVariant extends PublicCatalogNamedSlug {
  /** Every fuel it was offered with, its newest offering's first. */
  fuelTypes: FuelType[];
  /** The first year of its earliest offering. */
  yearStart: number | null;
  /** The last year of its latest offering; null while any offering is on sale. */
  yearEnd: number | null;
  /** Any of its offerings is on sale now. */
  isCurrent: boolean;
  /** From its spec row, when the catalog has one. */
  transmission: string | null;
}

/** A generation on a model page, with its variants: on sale first, then by name. */
export interface PublicCatalogModelGeneration extends PublicCatalogNamedSlug {
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
  variants: PublicCatalogModelVariant[];
}

/**
 * The public page for a model, `/cars/{make}/{model}`. It lists every
 * publishable variant at that address, grouped by generation (the current
 * generation first, then the most recent), and shows one schedule and one set
 * of specs.
 *
 * Those two belong to a single variant, the **representative**: a model has no
 * spec row or schedule of its own, and averaging its variants would invent
 * figures no variant has. The page says whose they are.
 */
export interface PublicCatalogModelPage {
  segment: PublicCatalogSegment;
  /** The representative variant's type, the one its schedule was resolved for. */
  vehicleType: VehicleType;
  make: PublicCatalogNamedSlug;
  model: PublicCatalogNamedSlug;
  /** Current first, then by most recent years. Never empty. */
  generations: PublicCatalogModelGeneration[];
  /**
   * The variant the specs and schedule come from: the newest variant on sale in
   * the current generation, preferring one the page-quality gate passes (see
   * `PublicCatalogService` for the full order).
   */
  representative: {
    generation: PublicCatalogNamedSlug;
    variant: PublicCatalogNamedSlug;
    specs: PublicCatalogSpec | null;
  };
  /** The representative variant's resolved schedule, exactly as its own page has it. */
  schedule: PublicCatalogSchedule;
  /**
   * The page-quality gate's verdict: indexable when any of its variants is.
   * The web build's indexing flag still has the last word.
   */
  indexable: boolean;
  /** ISO timestamp of the newest change to any of its variants, their offerings or specs. */
  updatedAt: string;
}

/**
 * The most model page payloads one bulk request returns. Like the variant
 * batches, they let the prerender read every model page in a few requests.
 */
export const PUBLIC_CATALOG_MODEL_PAGE_BATCH_MAX = 100;

/** One page of model page payloads, ordered by address: segment, make slug, model slug. */
export interface PublicCatalogModelPageBatch {
  items: PublicCatalogModelPage[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * One model as a make page lists it: enough to tell it from the make's other
 * models and link to its own page.
 */
export interface PublicCatalogMakeModel extends PublicCatalogNamedSlug {
  /** How many variant pages it has. */
  variantCount: number;
  /** Every fuel any of its variants was offered with, in the order they first appear. */
  fuelTypes: FuelType[];
  /** The first year any of its variants was offered. */
  yearStart: number | null;
  /** The last year any of its variants was offered; null while one is on sale. */
  yearEnd: number | null;
  /** Any of its variants is on sale now. */
  isCurrent: boolean;
}

/**
 * The public page for a make, `/cars/{make}`: every model with a public page at
 * that address, on sale first, then by name. Like a model page it is an
 * address, not a row: Hyundai is both a car and an SUV make with one slug, and
 * `/cars/hyundai` lists the models of both.
 */
export interface PublicCatalogMakePage {
  segment: PublicCatalogSegment;
  make: PublicCatalogNamedSlug;
  /** On sale first, then by name. Never empty. */
  models: PublicCatalogMakeModel[];
  /**
   * The page-quality gate's verdict: indexable when any of its models is, which
   * is when any variant under it is. The web build's indexing flag still has
   * the last word.
   */
  indexable: boolean;
  /** ISO timestamp of the newest change to any variant under it. */
  updatedAt: string;
}

/** One make as a browse page lists it. */
export interface PublicCatalogBrowseMake extends PublicCatalogNamedSlug {
  /** How many model pages it has. */
  modelCount: number;
}

/**
 * The public page for a segment, `/cars` or `/bikes`: every make with a public
 * page there, by name. Empty only when the catalog has nothing in the segment.
 */
export interface PublicCatalogBrowsePage {
  segment: PublicCatalogSegment;
  makes: PublicCatalogBrowseMake[];
}

import { FuelType, type PublicCatalogSpec } from '@vehicle-vault/shared';

/**
 * The page-quality gate: whether a public catalog page carries enough facts to
 * be worth a search engine's time. A thin page (a name and a typical schedule,
 * nothing else) drags the whole site down in search, so it stays `noindex`
 * even once indexing is switched on.
 *
 * Pure: it reads a page's facts and nothing else. The web build's indexing flag
 * overrides it (off means every page is `noindex`); that half lives in the web
 * head, because the flag is a build setting, not API state.
 */

/**
 * The fewest public spec fields a variant needs filled, counting every field
 * in the public allow-list (`PUBLIC_SPEC_FIELDS`). Bikes carry fewer fields
 * than cars, so the bar sits where a well-scraped bike still clears it.
 */
export const MIN_FILLED_PUBLIC_SPEC_FIELDS = 10;

/** A combustion variant needs one of these: engine displacement or power. */
export const ENGINE_SPEC_FIELDS = ['engineCc', 'powerPs'] as const satisfies ReadonlyArray<
  keyof PublicCatalogSpec
>;

/** An electric variant needs one of these instead: motor output or power. */
export const MOTOR_SPEC_FIELDS = ['motorKw', 'powerPs'] as const satisfies ReadonlyArray<
  keyof PublicCatalogSpec
>;

/**
 * The claimed efficiency a variant needs: km/L (km/kg for CNG) for combustion,
 * claimed range for an EV. A bike's `rangeKm` is its riding range on a tank,
 * so an EV is told apart by its fuel type, never by having a range.
 */
export const CLAIMED_MILEAGE_FIELD = 'mileageCombined' satisfies keyof PublicCatalogSpec;
export const CLAIMED_RANGE_FIELD = 'rangeKm' satisfies keyof PublicCatalogSpec;

export type PageQualityReason =
  | 'no-specs'
  | 'too-few-specs'
  | 'no-claimed-mileage'
  | 'no-claimed-range'
  | 'no-engine-data'
  | 'no-motor-data'
  | 'no-indexable-variant';

export type PageQuality = {
  indexable: boolean;
  /** Why not, when not; empty when indexable. */
  reasons: PageQualityReason[];
};

/** What the gate reads from a variant page: its fuel (from its newest offering) and its specs. */
export type VariantPageQualityInput = {
  fuelType: FuelType;
  specs: PublicCatalogSpec | null;
};

export function evaluateVariantPageQuality({
  fuelType,
  specs,
}: VariantPageQualityInput): PageQuality {
  if (!specs) return { indexable: false, reasons: ['no-specs'] };

  const electric = fuelType === FuelType.Electric;
  const reasons: PageQualityReason[] = [];

  if (countFilledSpecFields(specs) < MIN_FILLED_PUBLIC_SPEC_FIELDS) {
    reasons.push('too-few-specs');
  }
  if (electric) {
    if (!isFilled(specs[CLAIMED_RANGE_FIELD])) reasons.push('no-claimed-range');
    if (!MOTOR_SPEC_FIELDS.some((field) => isFilled(specs[field]))) reasons.push('no-motor-data');
  } else {
    if (!isFilled(specs[CLAIMED_MILEAGE_FIELD])) reasons.push('no-claimed-mileage');
    if (!ENGINE_SPEC_FIELDS.some((field) => isFilled(specs[field]))) reasons.push('no-engine-data');
  }

  return { indexable: reasons.length === 0, reasons };
}

/**
 * A model page is worth indexing when at least one of its variants is: the
 * model page lists them, so one solid variant gives it real content.
 */
export function evaluateModelPageQuality(variants: ReadonlyArray<PageQuality>): PageQuality {
  return variants.some((variant) => variant.indexable)
    ? { indexable: true, reasons: [] }
    : { indexable: false, reasons: ['no-indexable-variant'] };
}

/** How many public spec fields hold a fact. `false` is a fact (no ABS); an empty string is not. */
export function countFilledSpecFields(specs: PublicCatalogSpec): number {
  return Object.values(specs).filter(isFilled).length;
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

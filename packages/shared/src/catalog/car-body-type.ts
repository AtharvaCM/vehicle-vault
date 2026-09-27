/**
 * Car body types (#389): the labels the catalog stores for a car's
 * `bodyType`, and the ones the browse page offers as filter chips.
 *
 * CarWale says "MuvsMpvs", "CompactSuv" and "CompactSedan"; the catalog keeps
 * one label per shape instead, so "Compact SUV" is an SUV and a minivan is an
 * MUV. Shapes too rare to fill a chip are still stored, for the spec sheet.
 */
export const CAR_BODY_TYPES = [
  'Hatchback',
  'Sedan',
  'SUV',
  'MUV',
  'Coupe',
  'Convertible',
  'Pickup',
  'Wagon',
] as const;

export type CarBodyType = (typeof CAR_BODY_TYPES)[number];

/** The body types the browse page may offer as chips, in chip order. */
export const CAR_BODY_TYPE_CHIPS = ['Hatchback', 'Sedan', 'SUV', 'MUV'] as const;

export type CarBodyTypeChip = (typeof CAR_BODY_TYPE_CHIPS)[number];

/** Checked in order, so "Compact SUV" lands on SUV before anything else matches. */
const LABEL_PATTERNS: ReadonlyArray<readonly [RegExp, CarBodyType]> = [
  [/hatch/, 'Hatchback'],
  [/suv|crossover/, 'SUV'],
  [/muv|mpv|minivan|people ?carrier/, 'MUV'],
  [/sedan|saloon|notchback/, 'Sedan'],
  [/convertible|cabrio|roadster|spyder|spider/, 'Convertible'],
  [/coupe|coupé/, 'Coupe'],
  [/pick ?-?up/, 'Pickup'],
  [/wagon|estate|touring/, 'Wagon'],
];

/**
 * The catalog label for a body type as a source wrote it, or null when it is
 * empty or names no car shape the catalog knows ("Street", "Cruiser" and
 * other two-wheeler labels come back null).
 */
export function normaliseCarBodyType(raw: string | null | undefined): CarBodyType | null {
  if (!raw) return null;
  // "MuvsMpvs" → "muvs mpvs", "CompactSuv" → "compact suv".
  const label = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  if (!label) return null;
  for (const [pattern, bodyType] of LABEL_PATTERNS) {
    if (pattern.test(label)) return bodyType;
  }
  return null;
}

/** The chip's URL value: `/cars?body=suv`. */
export function carBodyTypeSlug(bodyType: CarBodyTypeChip): string {
  return bodyType.toLowerCase();
}

export function carBodyTypeChipFromSlug(slug: string | null | undefined): CarBodyTypeChip | null {
  if (!slug) return null;
  return CAR_BODY_TYPE_CHIPS.find((chip) => carBodyTypeSlug(chip) === slug.toLowerCase()) ?? null;
}

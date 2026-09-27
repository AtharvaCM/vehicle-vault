import {
  CAR_BODY_TYPE_CHIPS,
  carBodyTypeSlug,
  type CarBodyTypeChip,
  type PublicCatalogBrowsePage,
} from '@vehicle-vault/shared';

/**
 * The share of a segment's models that must have a body type before any chip
 * shows (#389). Below it, a "Hatchback" chip would list some hatchbacks and
 * silently drop the rest, which reads as the whole answer.
 */
export const BODY_TYPE_CHIP_MIN_COVERAGE = 0.9;

/** A chip with fewer models than this is not worth a chip. */
export const BODY_TYPE_CHIP_MIN_MODELS = 3;

export type BodyTypeChip = {
  bodyType: CarBodyTypeChip;
  slug: string;
  count: number;
};

/**
 * The browse page's body-type chips, in chip order, each with its model
 * count. Only cars have them, and none show until nearly every model has a
 * body type on file.
 */
export function bodyTypeChips(page: PublicCatalogBrowsePage): BodyTypeChip[] {
  if (page.segment !== 'cars' || page.models.length === 0) return [];

  const withBodyType = page.models.filter((model) => model.bodyType).length;
  if (withBodyType / page.models.length < BODY_TYPE_CHIP_MIN_COVERAGE) return [];

  return CAR_BODY_TYPE_CHIPS.map((bodyType) => ({
    bodyType,
    slug: carBodyTypeSlug(bodyType),
    count: page.models.filter((model) => model.bodyType === bodyType).length,
  })).filter((chip) => chip.count >= BODY_TYPE_CHIP_MIN_MODELS);
}

/** "SUVs", "Hatchbacks": a chip's models, as a heading. */
export function bodyTypePlural(bodyType: CarBodyTypeChip): string {
  return `${bodyType}s`;
}

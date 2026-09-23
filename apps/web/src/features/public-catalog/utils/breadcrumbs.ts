import type { PublicCatalogSegment } from '@vehicle-vault/shared';

import type { PublicCatalogAddress } from '../head/public-page-head';

/** One step of the catalog's hierarchy: browse → make → model → variant. */
export type PublicCatalogCrumb = {
  name: string;
  address: PublicCatalogAddress;
};

type Named = { name: string; slug: string };

/** What a breadcrumb trail needs from a page: as far down the hierarchy as the page goes. */
export type BreadcrumbSource = {
  segment: PublicCatalogSegment;
  make?: Named;
  model?: Named;
  generation?: { slug: string };
  variant?: Named;
};

export const SEGMENT_NAMES: Record<PublicCatalogSegment, string> = {
  cars: 'Cars',
  bikes: 'Bikes',
};

/**
 * The trail from the segment's browse page down to the page itself, which is
 * the last crumb: `Cars › Hyundai › i20 › Asta` on a variant page, `Cars ›
 * Hyundai` on a make page. The on-page breadcrumbs and the `BreadcrumbList`
 * JSON-LD are both built from it, so they cannot disagree.
 */
export function publicCatalogBreadcrumbs(page: BreadcrumbSource): PublicCatalogCrumb[] {
  const { segment, make, model, generation, variant } = page;
  const crumbs: PublicCatalogCrumb[] = [{ name: SEGMENT_NAMES[segment], address: { segment } }];
  if (!make) return crumbs;

  crumbs.push({ name: make.name, address: { segment, make: make.slug } });
  if (!model) return crumbs;

  crumbs.push({ name: model.name, address: { segment, make: make.slug, model: model.slug } });
  if (!generation || !variant) return crumbs;

  crumbs.push({
    name: variant.name,
    address: {
      segment,
      make: make.slug,
      model: model.slug,
      generation: generation.slug,
      variant: variant.slug,
    },
  });
  return crumbs;
}

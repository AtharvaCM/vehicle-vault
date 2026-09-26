import type { FuelType } from '../enums/fuel-type.enum';
import type {
  PublicCatalogBrowseMake,
  PublicCatalogBrowseModel,
  PublicCatalogBrowsePage,
  PublicCatalogIndexEntry,
  PublicCatalogMakeModel,
  PublicCatalogMakePage,
  PublicCatalogNamedSlug,
  PublicCatalogSegment,
} from '../types/public-catalog';

/*
 * Make and browse pages are summaries of the catalog index, built here and
 * nowhere else. The API serves them from its index rows and the web build's
 * prerender builds them from the index it has already read, so the two always
 * agree and the prerender needs no request per make.
 */

/**
 * Each variant address once, the first entry winning. Hyundai is both a car
 * and an SUV make with one slug, so two index rows can share an address; the
 * prerender writes the first one's page, and summaries count it once.
 */
export function uniquePublicCatalogVariants(
  entries: ReadonlyArray<PublicCatalogIndexEntry>,
): PublicCatalogIndexEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = [
      entry.segment,
      entry.make.slug,
      entry.model.slug,
      entry.generation.slug,
      entry.variant.slug,
    ].join('/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The make page at `/{segment}/{makeSlug}`, from index entries (any subset
 * that holds every entry with that make slug, in either segment), or null when
 * nothing is published there. Models from every make row with that slug are
 * merged by model slug; an entry with the slug in the other segment sets
 * `otherSegment`.
 */
export function buildPublicCatalogMakePage(
  entries: ReadonlyArray<PublicCatalogIndexEntry>,
  segment: PublicCatalogSegment,
  makeSlug: string,
): PublicCatalogMakePage | null {
  const atMake = uniquePublicCatalogVariants(entries).filter(
    (entry) => entry.segment === segment && entry.make.slug === makeSlug,
  );
  const [first] = atMake;
  if (!first) return null;

  const byModel = new Map<string, PublicCatalogIndexEntry[]>();
  for (const entry of atMake) {
    byModel.set(entry.model.slug, [...(byModel.get(entry.model.slug) ?? []), entry]);
  }

  return {
    segment,
    make: { name: first.make.name, slug: first.make.slug },
    models: [...byModel.values()].map(toMakeModel).sort(compareMakeModels),
    otherSegment:
      entries.find((entry) => entry.segment !== segment && entry.make.slug === makeSlug)?.segment ??
      null,
    indexable: atMake.some((entry) => entry.indexable),
    updatedAt: newestTimestamp(atMake.map((entry) => entry.updatedAt)),
  };
}

/**
 * The browse page at `/{segment}`: every make with a public page there, by
 * name, from index entries (any subset that holds the whole segment).
 */
export function buildPublicCatalogBrowsePage(
  entries: ReadonlyArray<PublicCatalogIndexEntry>,
  segment: PublicCatalogSegment,
): PublicCatalogBrowsePage {
  const makes = new Map<string, { make: PublicCatalogNamedSlug; models: Set<string> }>();
  const models = new Map<string, PublicCatalogBrowseModel>();
  for (const entry of entries) {
    if (entry.segment !== segment) continue;
    const make = makes.get(entry.make.slug) ?? {
      make: { name: entry.make.name, slug: entry.make.slug },
      models: new Set<string>(),
    };
    make.models.add(entry.model.slug);
    makes.set(entry.make.slug, make);

    const key = `${entry.make.slug}/${entry.model.slug}`;
    const model = models.get(key);
    models.set(key, {
      name: entry.model.name,
      slug: entry.model.slug,
      make: make.make,
      variantCount: (model?.variantCount ?? 0) + 1,
      isCurrent: Boolean(model?.isCurrent) || entry.isCurrent,
    });
  }

  return {
    segment,
    makes: [...makes.values()]
      .map(
        ({ make, models: makeModels }): PublicCatalogBrowseMake => ({
          ...make,
          modelCount: makeModels.size,
        }),
      )
      .sort(compareNames),
    models: [...models.values()].sort((a, b) => compareNames(a.make, b.make) || compareNames(a, b)),
  };
}

function toMakeModel(variants: PublicCatalogIndexEntry[]): PublicCatalogMakeModel {
  const [first] = variants as [PublicCatalogIndexEntry, ...PublicCatalogIndexEntry[]];
  const isCurrent = variants.some((variant) => variant.isCurrent);
  const starts = variants.flatMap((variant) => variant.yearStart ?? []);
  const ends = variants.flatMap((variant) => variant.yearEnd ?? []);

  return {
    name: first.model.name,
    slug: first.model.slug,
    variantCount: variants.length,
    fuelTypes: [...new Set<FuelType>(variants.flatMap((variant) => variant.fuelTypes))],
    yearStart: starts.length > 0 ? Math.min(...starts) : null,
    yearEnd: isCurrent || ends.length === 0 ? null : Math.max(...ends),
    isCurrent,
  };
}

/** On sale first, then by name. */
function compareMakeModels(a: PublicCatalogMakeModel, b: PublicCatalogMakeModel) {
  return Number(b.isCurrent) - Number(a.isCurrent) || compareNames(a, b);
}

/** Names as a person sorts them: "i10" before "i20", "Series 2" before "Series 10". */
function compareNames(a: PublicCatalogNamedSlug, b: PublicCatalogNamedSlug) {
  return (
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }) ||
    (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  );
}

function newestTimestamp(timestamps: string[]) {
  return timestamps.reduce((newest, timestamp) =>
    Date.parse(timestamp) > Date.parse(newest) ? timestamp : newest,
  );
}

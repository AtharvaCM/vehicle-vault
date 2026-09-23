import {
  APP_NAME,
  MaintenanceCategory,
  type PublicCatalogBrowsePage,
  type PublicCatalogMakePage,
  type PublicCatalogModelPage,
  type PublicCatalogSegment,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';

import {
  publicCatalogBreadcrumbs,
  SEGMENT_NAMES,
  type BreadcrumbSource,
} from '../utils/breadcrumbs';
import {
  describeInterval,
  describeModelScheduleBasis,
  describeOffering,
  describeScheduleBasis,
  formatFuelTypes,
  formatSpecNumber,
  modelFuelTypes,
  modelVariants,
  modelYearSpan,
} from '../utils/format-public-catalog';
import { isPageIndexed, PUBLIC_CATALOG_INDEXING } from './indexing';
import {
  breadcrumbListStructuredData,
  itemListStructuredData,
  modelPageStructuredData,
  serializeStructuredData,
  STRUCTURED_DATA_ELEMENT_ID,
  structuredDataGraph,
  variantPageStructuredData,
  type JsonLd,
} from './structured-data';

/**
 * The origin every canonical and Open Graph URL is absolute on: the custom
 * domain, never the `vercel.app` alias, so a page shared or crawled from the
 * alias still points at one address. Set per build with `VITE_CANONICAL_ORIGIN`.
 */
export const CANONICAL_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_CANONICAL_ORIGIN || 'https://vehicle-vault.middle-earth.in',
);

/**
 * The head a public catalog page carries, both in its prerendered HTML and
 * after a client-side navigation to it.
 */
export type PublicPageHead = {
  title: string;
  description: string;
  /** Absolute, on the canonical origin. */
  canonicalUrl: string;
  /** Absolute. */
  imageUrl: string;
  /**
   * `index, follow` only when the build's indexing flag is on and the API's
   * page-quality gate passed the page; `noindex` otherwise.
   */
  robots: 'noindex' | 'index, follow';
  /** schema.org JSON-LD describing the page's subject, or null for none. */
  structuredData: JsonLd | null;
};

type HeadOptions = {
  origin?: string;
  /** The global indexing flag; the build's `VITE_PUBLIC_CATALOG_INDEXING` unless given. */
  indexing?: boolean;
};

type Slugged = { slug: string };

/**
 * Where a public catalog page lives, by its slugs: a browse page names only
 * its segment, a make page its make, a model page its model, and a variant
 * page its generation and variant too.
 */
export type PublicCatalogAddress =
  | {
      segment: PublicCatalogSegment;
      make?: undefined;
      model?: undefined;
      generation?: undefined;
      variant?: undefined;
    }
  | {
      segment: PublicCatalogSegment;
      make: string;
      model?: undefined;
      generation?: undefined;
      variant?: undefined;
    }
  | {
      segment: PublicCatalogSegment;
      make: string;
      model: string;
      generation?: undefined;
      variant?: undefined;
    }
  | {
      segment: PublicCatalogSegment;
      make: string;
      model: string;
      generation: string;
      variant: string;
    };

/** `/cars`, `/cars/hyundai`, `/cars/hyundai/i20` or a variant's path: whatever the address names. */
export function publicCatalogPath(address: PublicCatalogAddress) {
  const { segment, make, model, generation, variant } = address;
  return `/${[segment, make, model, generation, variant]
    .filter((part): part is string => part !== undefined)
    .map(encodeURIComponent)
    .join('/')}`;
}

/** `/cars/{make}/{model}/{generation}/{variant}`, from a page payload or an index entry. */
export function publicVariantPath(page: {
  segment: string;
  make: Slugged;
  model: Slugged;
  generation: Slugged;
  variant: Slugged;
}) {
  return `/${[
    page.segment,
    page.make.slug,
    page.model.slug,
    page.generation.slug,
    page.variant.slug,
  ]
    .map(encodeURIComponent)
    .join('/')}`;
}

export function variantPageTitle(page: PublicCatalogVariantPage) {
  return `${page.make.name} ${page.model.name} ${page.variant.name} — service schedule and specs | ${APP_NAME}`;
}

/**
 * One line a link preview can show: what the variant is, what its schedule
 * asks for, and a few headline specs when the catalog has them.
 */
export function variantPageDescription(page: PublicCatalogVariantPage) {
  const name = `${page.make.name} ${page.model.name} ${page.variant.name}`;
  const offering = page.offerings[0] ? ` (${describeOffering(page.offerings[0])})` : '';
  const periodic = page.schedule.items.find(
    (item) => item.category === MaintenanceCategory.PeriodicService,
  );
  const schedule = periodic
    ? `${describeScheduleBasis(page.schedule)}: a periodic service ${lowerFirst(describeInterval(periodic))}.`
    : `${describeScheduleBasis(page.schedule)}, item by item.`;
  const specs = headlineSpecs(page);

  return `Service schedule and specs for the ${name}${offering}. ${schedule}${
    specs.length > 0 ? ` ${specs.join(' · ')}.` : ''
  }`;
}

export function variantPageHead(
  page: PublicCatalogVariantPage,
  { origin = CANONICAL_ORIGIN, indexing = PUBLIC_CATALOG_INDEXING }: HeadOptions = {},
): PublicPageHead {
  const base = normalizeOrigin(origin);
  const canonicalUrl = `${base}${publicVariantPath(page)}`;

  return {
    title: variantPageTitle(page),
    description: variantPageDescription(page),
    canonicalUrl,
    imageUrl: `${base}/web-app-manifest-512x512.png`,
    robots: isPageIndexed(page, indexing) ? 'index, follow' : 'noindex',
    structuredData: structuredDataGraph([
      variantPageStructuredData(page, canonicalUrl),
      breadcrumbListStructuredData(breadcrumbTrail(page, base)),
    ]),
  };
}

/** `/cars/{make}/{model}`, from a model page payload, a variant page or an index entry. */
export function publicModelPath(page: { segment: string; make: Slugged; model: Slugged }) {
  return `/${[page.segment, page.make.slug, page.model.slug].map(encodeURIComponent).join('/')}`;
}

export function modelPageTitle(page: PublicCatalogModelPage) {
  return `${page.make.name} ${page.model.name} — variants, service schedule and specs | ${APP_NAME}`;
}

/**
 * One line a link preview can show: how many variants the model has and over
 * which years, and what its schedule asks for.
 */
export function modelPageDescription(page: PublicCatalogModelPage) {
  const name = `${page.make.name} ${page.model.name}`;
  const count = modelVariants(page).length;
  const years = modelYearSpan(page);
  const fuels = formatFuelTypes(modelFuelTypes(page));
  const detail = [years, fuels].filter(Boolean).join(' · ');
  const periodic = page.schedule.items.find(
    (item) => item.category === MaintenanceCategory.PeriodicService,
  );
  const basis = describeModelScheduleBasis(page);
  const schedule = periodic
    ? `${basis}: a periodic service ${lowerFirst(describeInterval(periodic))}.`
    : `${basis}, item by item.`;

  return `All ${count} ${count === 1 ? 'variant' : 'variants'} of the ${name}${
    detail ? ` (${detail})` : ''
  }, by generation, with a service schedule and specs. ${schedule}`;
}

export function modelPageHead(
  page: PublicCatalogModelPage,
  { origin = CANONICAL_ORIGIN, indexing = PUBLIC_CATALOG_INDEXING }: HeadOptions = {},
): PublicPageHead {
  const base = normalizeOrigin(origin);
  const canonicalUrl = `${base}${publicModelPath(page)}`;

  return {
    title: modelPageTitle(page),
    description: modelPageDescription(page),
    canonicalUrl,
    imageUrl: `${base}/web-app-manifest-512x512.png`,
    robots: isPageIndexed(page, indexing) ? 'index, follow' : 'noindex',
    structuredData: structuredDataGraph([
      modelPageStructuredData(page, canonicalUrl),
      breadcrumbListStructuredData(breadcrumbTrail(page, base)),
    ]),
  };
}

const SEGMENT_NOUNS: Record<PublicCatalogSegment, string> = { cars: 'cars', bikes: 'bikes' };

export function makePageTitle(page: PublicCatalogMakePage) {
  return `${page.make.name} ${SEGMENT_NOUNS[page.segment]} — models, service schedules and specs | ${APP_NAME}`;
}

/** One line a link preview can show: the make's models, the first few by name. */
export function makePageDescription(page: PublicCatalogMakePage) {
  const count = page.models.length;
  return `Service schedules, running costs and specs for ${count} ${page.make.name} ${
    count === 1 ? 'model' : 'models'
  }: ${listSome(page.models.map((model) => model.name))}. Pick a model for its variants.`;
}

export function makePageHead(
  page: PublicCatalogMakePage,
  { origin = CANONICAL_ORIGIN, indexing = PUBLIC_CATALOG_INDEXING }: HeadOptions = {},
): PublicPageHead {
  const base = normalizeOrigin(origin);
  const canonicalUrl = `${base}${publicCatalogPath({ segment: page.segment, make: page.make.slug })}`;
  const models = page.models.map((model) => ({
    name: `${page.make.name} ${model.name}`,
    url: `${base}${publicCatalogPath({ segment: page.segment, make: page.make.slug, model: model.slug })}`,
  }));

  return {
    title: makePageTitle(page),
    description: makePageDescription(page),
    canonicalUrl,
    imageUrl: `${base}/web-app-manifest-512x512.png`,
    robots: isPageIndexed(page, indexing) ? 'index, follow' : 'noindex',
    structuredData: structuredDataGraph([
      itemListStructuredData(`${page.make.name} ${SEGMENT_NOUNS[page.segment]}`, models),
      breadcrumbListStructuredData(breadcrumbTrail(page, base)),
    ]),
  };
}

export function browsePageTitle(page: PublicCatalogBrowsePage) {
  return `${SEGMENT_NAMES[page.segment]} by make — models, service schedules and specs | ${APP_NAME}`;
}

/** One line a link preview can show: how many makes, and the first few by name. */
export function browsePageDescription(page: PublicCatalogBrowsePage) {
  const count = page.makes.length;
  const noun = SEGMENT_NOUNS[page.segment];
  if (count === 0) return `Service schedules, running costs and specs for ${noun} sold in India.`;
  return `Service schedules, running costs and specs for ${noun} from ${count} ${
    count === 1 ? 'make' : 'makes'
  } sold in India: ${listSome(page.makes.map((make) => make.name))}.`;
}

/**
 * A browse page is indexed whenever indexing is on and it lists anything: it
 * is the way in to every make, so the page-quality gate does not judge it.
 */
export function browsePageHead(
  page: PublicCatalogBrowsePage,
  { origin = CANONICAL_ORIGIN, indexing = PUBLIC_CATALOG_INDEXING }: HeadOptions = {},
): PublicPageHead {
  const base = normalizeOrigin(origin);
  const canonicalUrl = `${base}${publicCatalogPath({ segment: page.segment })}`;
  const makes = page.makes.map((make) => ({
    name: make.name,
    url: `${base}${publicCatalogPath({ segment: page.segment, make: make.slug })}`,
  }));

  return {
    title: browsePageTitle(page),
    description: browsePageDescription(page),
    canonicalUrl,
    imageUrl: `${base}/web-app-manifest-512x512.png`,
    robots: isPageIndexed({ indexable: page.makes.length > 0 }, indexing)
      ? 'index, follow'
      : 'noindex',
    structuredData: {
      '@context': 'https://schema.org',
      ...itemListStructuredData(`${SEGMENT_NAMES[page.segment]} by make`, makes),
    },
  };
}

/** The page's breadcrumbs as named absolute URLs, for its `BreadcrumbList`. */
function breadcrumbTrail(page: BreadcrumbSource, base: string) {
  return publicCatalogBreadcrumbs(page).map((crumb) => ({
    name: crumb.name,
    url: `${base}${publicCatalogPath(crumb.address)}`,
  }));
}

/** "A, B and C", or "A, B, C and 9 more" past three. */
function listSome(names: string[], shown = 3) {
  if (names.length <= 1) return names.join('');
  if (names.length <= shown) return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${names.slice(0, shown).join(', ')} and ${names.length - shown} more`;
}

/**
 * The tags, as HTML, for the prerender to put in a page's `<head>`. Every value
 * is escaped: names come from the catalog, not from us.
 */
export function renderHeadTags(head: PublicPageHead) {
  return [
    `<title>${escapeHtml(head.title)}</title>`,
    ...headTagSpecs(head).map((tag) =>
      tag.kind === 'link'
        ? `<link rel="${tag.key}" href="${escapeHtml(tag.value)}" />`
        : `<meta ${tag.kind}="${tag.key}" content="${escapeHtml(tag.value)}" />`,
    ),
    ...(head.structuredData
      ? [
          `<script type="application/ld+json" id="${STRUCTURED_DATA_ELEMENT_ID}">${serializeStructuredData(
            head.structuredData,
          )}</script>`,
        ]
      : []),
  ].join('\n    ');
}

export type HeadTagSpec = {
  kind: 'name' | 'property' | 'link';
  key: string;
  value: string;
};

/** Every tag a public page sets besides `<title>`, in the order they are written. */
export function headTagSpecs(head: PublicPageHead): HeadTagSpec[] {
  return [
    { kind: 'name', key: 'description', value: head.description },
    { kind: 'name', key: 'robots', value: head.robots },
    { kind: 'link', key: 'canonical', value: head.canonicalUrl },
    { kind: 'property', key: 'og:type', value: 'website' },
    { kind: 'property', key: 'og:site_name', value: APP_NAME },
    { kind: 'property', key: 'og:title', value: head.title },
    { kind: 'property', key: 'og:description', value: head.description },
    { kind: 'property', key: 'og:url', value: head.canonicalUrl },
    { kind: 'property', key: 'og:image', value: head.imageUrl },
    { kind: 'name', key: 'twitter:card', value: 'summary' },
    { kind: 'name', key: 'twitter:title', value: head.title },
    { kind: 'name', key: 'twitter:description', value: head.description },
    { kind: 'name', key: 'twitter:image', value: head.imageUrl },
  ];
}

function headlineSpecs(page: PublicCatalogVariantPage) {
  const specs = page.specs;
  if (!specs) return [];

  const parts: string[] = [];
  if (specs.engineCc) parts.push(`${formatSpecNumber(specs.engineCc)} cc`);
  if (specs.powerPs) parts.push(`${formatSpecNumber(specs.powerPs)} PS`);
  if (specs.batteryKwh) parts.push(`${formatSpecNumber(specs.batteryKwh)} kWh battery`);
  if (specs.rangeKm) parts.push(`${formatSpecNumber(specs.rangeKm)} km claimed range`);
  else if (specs.mileageCombined)
    parts.push(`${formatSpecNumber(specs.mileageCombined)} km/l claimed`);
  return parts;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '');
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

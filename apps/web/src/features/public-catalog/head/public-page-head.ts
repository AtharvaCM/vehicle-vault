import {
  APP_NAME,
  MaintenanceCategory,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';

import {
  describeInterval,
  describeOffering,
  describeScheduleBasis,
  formatSpecNumber,
} from '../utils/format-public-catalog';

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
   * Every page is `noindex` until the indexing flag and the page-quality gate
   * (#175) decide otherwise.
   */
  robots: 'noindex' | 'index, follow';
};

type HeadOptions = {
  origin?: string;
  indexable?: boolean;
};

type Slugged = { slug: string };

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
  { origin = CANONICAL_ORIGIN, indexable = false }: HeadOptions = {},
): PublicPageHead {
  const base = normalizeOrigin(origin);

  return {
    title: variantPageTitle(page),
    description: variantPageDescription(page),
    canonicalUrl: `${base}${publicVariantPath(page)}`,
    imageUrl: `${base}/web-app-manifest-512x512.png`,
    robots: indexable ? 'index, follow' : 'noindex',
  };
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

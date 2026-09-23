import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogSpec,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CANONICAL_ORIGIN, renderHeadTags, variantPageHead } from './public-page-head';
import {
  APP_DEFAULT_HEAD,
  applyPublicPageHead,
  restoreAppDefaultHead,
  usePublicPageHead,
} from './use-public-page-head';

function page(overrides: Partial<PublicCatalogVariantPage> = {}): PublicCatalogVariantPage {
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Hyundai', slug: 'hyundai' },
    model: { name: 'i20', slug: 'i20' },
    generation: {
      name: 'i20 lineup',
      slug: 'i20-lineup',
      yearStart: 2020,
      yearEnd: null,
      isCurrent: true,
    },
    variant: { name: 'Asta', slug: 'asta' },
    offerings: [{ fuelTypes: [FuelType.Petrol], yearStart: 2023, yearEnd: null, isCurrent: true }],
    specs: null,
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      items: [
        { category: MaintenanceCategory.PeriodicService, km: 10000, months: 12, source: 'default' },
      ],
    },
    calculatorSeed: {
      fuelType: FuelType.Petrol,
      claimedMileage: null,
      claimedRangeKm: null,
      batteryKwh: null,
    },
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

const specs = (values: Partial<PublicCatalogSpec>) => values as PublicCatalogSpec;

describe('variantPageHead', () => {
  it('puts the canonical on the custom domain by default, never a vercel.app alias', () => {
    const head = variantPageHead(page());

    expect(CANONICAL_ORIGIN).toBe('https://vehicle-vault.middle-earth.in');
    expect(head.canonicalUrl).toBe(
      'https://vehicle-vault.middle-earth.in/cars/hyundai/i20/i20-lineup/asta',
    );
    expect(head.imageUrl).toBe(
      'https://vehicle-vault.middle-earth.in/web-app-manifest-512x512.png',
    );
  });

  it('takes another origin, without a trailing slash doubling up', () => {
    expect(variantPageHead(page(), { origin: 'https://catalog.example.test/' }).canonicalUrl).toBe(
      'https://catalog.example.test/cars/hyundai/i20/i20-lineup/asta',
    );
  });

  it('is noindex unless the page is marked indexable', () => {
    expect(variantPageHead(page()).robots).toBe('noindex');
    expect(variantPageHead(page(), { indexable: true }).robots).toBe('index, follow');
  });

  it('summarises headline specs when the catalog has them', () => {
    const head = variantPageHead(
      page({ specs: specs({ engineCc: 1197, powerPs: 83, mileageCombined: 20.3 }) }),
    );

    expect(head.description).toBe(
      'Service schedule and specs for the Hyundai i20 Asta (2023 – present · Petrol). ' +
        'Typical schedule for a petrol car: a periodic service every 10,000 km or 12 months, ' +
        'whichever comes first. 1,197 cc · 83 PS · 20.3 km/l claimed.',
    );
  });

  it('gives an EV its battery and range instead of a mileage', () => {
    const head = variantPageHead(
      page({ specs: specs({ batteryKwh: 45, rangeKm: 465, mileageCombined: null }) }),
    );

    expect(head.description).toContain('45 kWh battery · 465 km claimed range.');
    expect(head.description).not.toContain('km/l');
  });

  it('still describes a schedule with no periodic service', () => {
    const head = variantPageHead(
      page({ schedule: { ...page().schedule, basis: 'variant', items: [] }, offerings: [] }),
    );

    expect(head.description).toBe(
      'Service schedule and specs for the Hyundai i20 Asta. This variant’s schedule, item by item.',
    );
  });
});

describe('renderHeadTags', () => {
  it('escapes names from the catalog', () => {
    const html = renderHeadTags(
      variantPageHead(page({ variant: { name: 'Sport "R" <X> & co', slug: 'sport-r' } })),
    );

    expect(html).toContain('<title>Hyundai i20 Sport &quot;R&quot; &lt;X&gt; &amp; co');
    expect(html).not.toContain('<X>');
  });
});

describe('client head updates', () => {
  afterEach(() => {
    restoreAppDefaultHead(document);
  });

  const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');
  const canonical = () =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  it('sets the page head on mount and puts the app defaults back on unmount', () => {
    const head = variantPageHead(page());
    const { unmount } = renderHook(() => usePublicPageHead(head));

    expect(document.title).toBe(head.title);
    expect(canonical()).toBe(head.canonicalUrl);
    expect(meta('meta[name="robots"]')).toBe('noindex');
    expect(meta('meta[property="og:title"]')).toBe(head.title);
    expect(meta('meta[name="description"]')).toBe(head.description);

    unmount();

    expect(document.title).toBe(APP_DEFAULT_HEAD.title);
    expect(canonical()).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(meta('meta[property="og:title"]')).toBe(APP_DEFAULT_HEAD.title);
  });

  it('updates existing tags in place rather than adding more', () => {
    applyPublicPageHead(document, variantPageHead(page()));
    applyPublicPageHead(
      document,
      variantPageHead(page({ variant: { name: 'Sportz', slug: 'sportz' } })),
    );

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(canonical()).toBe(
      'https://vehicle-vault.middle-earth.in/cars/hyundai/i20/i20-lineup/sportz',
    );
  });

  it('keeps the app defaults in step with index.html', () => {
    const indexHtml = readFileSync(
      path.resolve(__dirname, '../../../../index.html'),
      'utf8',
    ).replace(/\s+/g, ' ');

    expect(indexHtml).toContain(`<title>${APP_DEFAULT_HEAD.title}</title>`);
    for (const tag of APP_DEFAULT_HEAD.tags) {
      expect(indexHtml).toContain(`${tag.kind}="${tag.key}" content="${tag.value}"`);
    }
  });
});

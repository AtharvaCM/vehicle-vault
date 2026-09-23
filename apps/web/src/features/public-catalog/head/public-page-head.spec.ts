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

import { isPageIndexed, parseIndexingFlag, PUBLIC_CATALOG_INDEXING } from './indexing';
import { CANONICAL_ORIGIN, renderHeadTags, variantPageHead } from './public-page-head';
import {
  serializeStructuredData,
  STRUCTURED_DATA_ELEMENT_ID,
  structuredDataNodes,
  type JsonLd,
} from './structured-data';
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
    indexable: false,
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

  it('is noindex by default: indexing is off unless the build turns it on', () => {
    expect(PUBLIC_CATALOG_INDEXING).toBe(false);
    expect(variantPageHead(page()).robots).toBe('noindex');
    expect(variantPageHead(page({ indexable: true })).robots).toBe('noindex');
  });

  it('with indexing on, follows the page-quality gate', () => {
    expect(variantPageHead(page({ indexable: true }), { indexing: true }).robots).toBe(
      'index, follow',
    );
    expect(variantPageHead(page({ indexable: false }), { indexing: true }).robots).toBe('noindex');
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

describe('the indexing flag', () => {
  it('is on only for on, true or 1', () => {
    for (const value of ['on', 'ON', ' true ', '1']) expect(parseIndexingFlag(value)).toBe(true);
    for (const value of [undefined, '', 'off', 'false', '0', 'yes', 'no'])
      expect(parseIndexingFlag(value)).toBe(false);
  });

  it('overrides the gate: off, even a page the gate passes is not indexed', () => {
    expect(isPageIndexed({ indexable: true }, false)).toBe(false);
    expect(isPageIndexed({ indexable: false }, false)).toBe(false);
    expect(isPageIndexed({ indexable: true }, true)).toBe(true);
    expect(isPageIndexed({ indexable: false }, true)).toBe(false);
  });
});

/** The page's `Car` or `Motorcycle` node, out of its JSON-LD graph. */
function vehicleNode(data: JsonLd | null | undefined): JsonLd {
  const node = structuredDataNodes(data ?? {}).find((entry) =>
    ['Car', 'Motorcycle'].includes(String(entry['@type'])),
  );
  expect(node).toBeDefined();
  return node ?? {};
}

describe('structured data', () => {
  const jsonLd = (html: string) => {
    const match = html.match(
      new RegExp(
        `<script type="application/ld\\+json" id="${STRUCTURED_DATA_ELEMENT_ID}">(.*?)</script>`,
      ),
    );
    expect(match).not.toBeNull();
    return JSON.parse(match?.[1] ?? 'null') as JsonLd;
  };

  it('describes a car with its engine and claimed mileage', () => {
    const head = variantPageHead(
      page({
        specs: specs({
          engineCc: 1197,
          powerPs: 83,
          torqueNm: 115,
          engineType: '1.2L Kappa',
          mileageCombined: 20.3,
          transmission: 'Manual',
          seatingCapacity: 5,
          fuelCapLitres: 37,
        }),
      }),
    );

    expect(vehicleNode(jsonLd(renderHeadTags(head)))).toEqual({
      '@type': 'Car',
      name: 'Hyundai i20 Asta',
      url: 'https://vehicle-vault.middle-earth.in/cars/hyundai/i20/i20-lineup/asta',
      brand: { '@type': 'Brand', name: 'Hyundai' },
      model: 'i20',
      vehicleConfiguration: 'Asta',
      fuelType: 'Petrol',
      vehicleModelDate: '2020',
      vehicleEngine: {
        '@type': 'EngineSpecification',
        fuelType: 'Petrol',
        engineType: '1.2L Kappa',
        engineDisplacement: { '@type': 'QuantitativeValue', value: 1197, unitCode: 'CMQ' },
        enginePower: { '@type': 'QuantitativeValue', value: 83, unitText: 'PS' },
        torque: { '@type': 'QuantitativeValue', value: 115, unitCode: 'NU' },
      },
      fuelEfficiency: { '@type': 'QuantitativeValue', value: 20.3, unitText: 'km/L' },
      vehicleTransmission: 'Manual',
      seatingCapacity: 5,
      fuelCapacity: { '@type': 'QuantitativeValue', value: 37, unitCode: 'LTR' },
    });
  });

  it('makes a bike a Motorcycle', () => {
    const head = variantPageHead(
      page({ segment: 'bikes', vehicleType: VehicleType.Motorcycle, specs: specs({}) }),
    );

    expect(vehicleNode(head.structuredData)['@type']).toBe('Motorcycle');
  });

  it('gives an EV its motor, range and battery, and no fuel efficiency or tank', () => {
    const head = variantPageHead(
      page({
        offerings: [
          { fuelTypes: [FuelType.Electric], yearStart: 2024, yearEnd: null, isCurrent: true },
        ],
        calculatorSeed: {
          fuelType: FuelType.Electric,
          claimedMileage: null,
          claimedRangeKm: 489,
          batteryKwh: 45,
        },
        specs: specs({ motorKw: 110, powerPs: 150, rangeKm: 489, batteryKwh: 45 }),
      }),
    );
    const data = vehicleNode(head.structuredData);

    expect(data.fuelType).toBe('Electric');
    expect(data.vehicleEngine).toEqual({
      '@type': 'EngineSpecification',
      engineType: 'Electric motor',
      fuelType: 'Electric',
      enginePower: { '@type': 'QuantitativeValue', value: 110, unitCode: 'KWT' },
    });
    expect(data).not.toHaveProperty('fuelEfficiency');
    expect(data).not.toHaveProperty('fuelCapacity');
    expect(data.additionalProperty).toEqual([
      { '@type': 'PropertyValue', name: 'Claimed range', value: 489, unitCode: 'KMT' },
      { '@type': 'PropertyValue', name: 'Battery capacity', value: 45, unitCode: 'KWH' },
    ]);
  });

  it('leaves out what the catalog does not know', () => {
    const data = vehicleNode(variantPageHead(page()).structuredData);

    expect(data).not.toHaveProperty('vehicleEngine');
    expect(data).not.toHaveProperty('fuelEfficiency');
    expect(JSON.stringify(data)).not.toContain('null');
  });

  it('lists every fuel a variant is sold with', () => {
    const data = vehicleNode(
      variantPageHead(
        page({
          offerings: [
            {
              fuelTypes: [FuelType.Petrol, FuelType.CNG],
              yearStart: 2023,
              yearEnd: null,
              isCurrent: true,
            },
          ],
        }),
      ).structuredData,
    );

    expect(data.fuelType).toEqual(['Petrol', 'CNG']);
  });

  it('cannot be broken out of by a catalog name', () => {
    const name = '</script><script>alert(1)</script> <!-- & \u2028';
    const html = renderHeadTags(variantPageHead(page({ variant: { name, slug: 'odd' } })));
    const script = html.slice(html.indexOf('<script type="application/ld+json"'));

    // One script element, closed once, at its own end.
    expect(script.match(/<\/script>/gi)).toHaveLength(1);
    expect(script.endsWith('</script>')).toBe(true);
    expect(script).not.toContain('<!--');
    // Still valid JSON, and the name comes back exactly.
    expect(vehicleNode(jsonLd(html)).vehicleConfiguration).toBe(name);
  });

  it('puts the Car and its breadcrumbs in one graph, under one context', () => {
    const data = variantPageHead(page()).structuredData ?? {};

    expect(data['@context']).toBe('https://schema.org');
    expect(structuredDataNodes(data).map((node) => node['@type'])).toEqual([
      'Car',
      'BreadcrumbList',
    ]);
    expect(structuredDataNodes(data).some((node) => '@context' in node)).toBe(false);
  });

  it('gives a variant a BreadcrumbList from the browse page down to itself', () => {
    const data = variantPageHead(page(), {
      origin: 'https://catalog.example.test/',
    }).structuredData;

    expect(
      structuredDataNodes(data ?? {}).find((node) => node['@type'] === 'BreadcrumbList'),
    ).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Cars',
          item: 'https://catalog.example.test/cars',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Hyundai',
          item: 'https://catalog.example.test/cars/hyundai',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'i20',
          item: 'https://catalog.example.test/cars/hyundai/i20',
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'Asta',
          item: 'https://catalog.example.test/cars/hyundai/i20/i20-lineup/asta',
        },
      ],
    });
  });

  it('serializes to JSON that parses back to the same data', () => {
    const data = { '@type': 'Car', name: 'A <b> & "c"' };
    expect(JSON.parse(serializeStructuredData(data))).toEqual(data);
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
    const script = document.getElementById(STRUCTURED_DATA_ELEMENT_ID);
    expect(script?.getAttribute('type')).toBe('application/ld+json');
    expect(JSON.parse(script?.textContent ?? 'null')).toEqual(head.structuredData);

    unmount();

    expect(document.getElementById(STRUCTURED_DATA_ELEMENT_ID)).toBeNull();
    expect(document.title).toBe(APP_DEFAULT_HEAD.title);
    expect(canonical()).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(meta('meta[property="og:title"]')).toBe(APP_DEFAULT_HEAD.title);
  });

  it('sets robots from the flag and the gate, the same as the static HTML', () => {
    applyPublicPageHead(document, variantPageHead(page({ indexable: true }), { indexing: true }));
    expect(meta('meta[name="robots"]')).toBe('index, follow');

    applyPublicPageHead(document, variantPageHead(page({ indexable: true }), { indexing: false }));
    expect(meta('meta[name="robots"]')).toBe('noindex');
  });

  it('updates existing tags in place rather than adding more', () => {
    applyPublicPageHead(document, variantPageHead(page()));
    applyPublicPageHead(
      document,
      variantPageHead(page({ variant: { name: 'Sportz', slug: 'sportz' } })),
    );

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
    expect(
      vehicleNode(
        JSON.parse(document.getElementById(STRUCTURED_DATA_ELEMENT_ID)?.textContent ?? '{}'),
      ).vehicleConfiguration,
    ).toBe('Sportz');
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

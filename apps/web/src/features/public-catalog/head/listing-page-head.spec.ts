import {
  FuelType,
  type PublicCatalogBrowsePage,
  type PublicCatalogMakeModel,
  type PublicCatalogMakePage,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import {
  browsePageHead,
  makePageDescription,
  makePageHead,
  publicCatalogPath,
  renderHeadTags,
} from './public-page-head';
import { structuredDataNodes } from './structured-data';

const ORIGIN = 'https://catalog.example.test';

function model(name: string, overrides: Partial<PublicCatalogMakeModel> = {}) {
  return {
    name,
    slug: name.toLowerCase(),
    variantCount: 2,
    fuelTypes: [FuelType.Petrol],
    yearStart: 2020,
    yearEnd: null,
    isCurrent: true,
    ...overrides,
  };
}

function makePage(overrides: Partial<PublicCatalogMakePage> = {}): PublicCatalogMakePage {
  return {
    segment: 'cars',
    make: { name: 'Hyundai', slug: 'hyundai' },
    models: [model('Creta'), model('i20'), model('Venue')],
    indexable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

const browsePage: PublicCatalogBrowsePage = {
  segment: 'cars',
  makes: [
    { name: 'Honda', slug: 'honda', modelCount: 6 },
    { name: 'Hyundai', slug: 'hyundai', modelCount: 12 },
    { name: 'Kia', slug: 'kia', modelCount: 5 },
    { name: 'Tata', slug: 'tata', modelCount: 9 },
  ],
  models: [],
};

describe('publicCatalogPath', () => {
  it('names as much of the hierarchy as the address does', () => {
    expect(publicCatalogPath({ segment: 'bikes' })).toBe('/bikes');
    expect(publicCatalogPath({ segment: 'cars', make: 'hyundai' })).toBe('/cars/hyundai');
    expect(publicCatalogPath({ segment: 'cars', make: 'hyundai', model: 'i20' })).toBe(
      '/cars/hyundai/i20',
    );
    expect(
      publicCatalogPath({
        segment: 'cars',
        make: 'hyundai',
        model: 'i20',
        generation: 'i20-lineup',
        variant: 'asta (o)',
      }),
    ).toBe('/cars/hyundai/i20/i20-lineup/asta%20(o)');
  });
});

describe('makePageHead', () => {
  it('gives the make page its title, absolute canonical and preview tags', () => {
    const head = makePageHead(makePage(), { origin: `${ORIGIN}/` });

    expect(head.title).toBe('Hyundai cars — models, service schedules and specs | Vehicle Vault');
    expect(head.canonicalUrl).toBe(`${ORIGIN}/cars/hyundai`);
    expect(head.imageUrl).toBe(`${ORIGIN}/web-app-manifest-512x512.png`);
    expect(head.description).toBe(
      'Service schedules, running costs and specs for 3 Hyundai models: Creta, i20 and Venue. ' +
        'Pick a model for its variants.',
    );
  });

  it('names the first few models and counts the rest', () => {
    const page = makePage({
      models: ['Alcazar', 'Creta', 'i10', 'i20', 'Venue'].map((name) => model(name)),
    });
    expect(makePageDescription(page)).toContain(
      '5 Hyundai models: Alcazar, Creta, i10 and 2 more.',
    );
    expect(makePageDescription(makePage({ models: [model('i20')] }))).toContain(
      '1 Hyundai model: i20.',
    );
  });

  it('is noindex with indexing off, and follows its models with it on', () => {
    expect(makePageHead(makePage({ indexable: true }), { indexing: false }).robots).toBe('noindex');
    expect(makePageHead(makePage({ indexable: true }), { indexing: true }).robots).toBe(
      'index, follow',
    );
    expect(makePageHead(makePage({ indexable: false }), { indexing: true }).robots).toBe('noindex');
  });

  it('describes its models as an ItemList, with a BreadcrumbList up to the browse page', () => {
    const head = makePageHead(makePage({ models: [model('Creta'), model('i20')] }), {
      origin: ORIGIN,
    });

    expect(head.structuredData).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ItemList',
          name: 'Hyundai cars',
          numberOfItems: 2,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Hyundai Creta',
              url: `${ORIGIN}/cars/hyundai/creta`,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Hyundai i20',
              url: `${ORIGIN}/cars/hyundai/i20`,
            },
          ],
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Cars', item: `${ORIGIN}/cars` },
            { '@type': 'ListItem', position: 2, name: 'Hyundai', item: `${ORIGIN}/cars/hyundai` },
          ],
        },
      ],
    });
  });

  it('escapes catalog names in the rendered tags and keeps the JSON-LD whole', () => {
    const html = renderHeadTags(
      makePageHead(makePage({ make: { name: 'A </script> & B', slug: 'a-b' } })),
    );

    expect(html).toContain('<title>A &lt;/script&gt; &amp; B cars');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    const json = html.slice(html.indexOf('>', html.indexOf('ld+json')) + 1, html.lastIndexOf('<'));
    expect(structuredDataNodes(JSON.parse(json))[1]).toMatchObject({
      itemListElement: [{ name: 'Cars' }, { name: 'A </script> & B' }],
    });
  });
});

describe('browsePageHead', () => {
  it('gives the browse page its title, canonical and a description naming a few makes', () => {
    const head = browsePageHead(browsePage, { origin: ORIGIN });

    expect(head.title).toBe('Cars by make — models, service schedules and specs | Vehicle Vault');
    expect(head.canonicalUrl).toBe(`${ORIGIN}/cars`);
    expect(head.description).toBe(
      'Service schedules, running costs and specs for cars from 4 makes sold in India: ' +
        'Honda, Hyundai, Kia and 1 more.',
    );
    expect(
      browsePageHead({ segment: 'bikes', makes: [], models: [] }, { origin: ORIGIN }).title,
    ).toBe('Bikes by make — models, service schedules and specs | Vehicle Vault');
  });

  it('is indexed whenever indexing is on and it lists a make, and never with indexing off', () => {
    expect(browsePageHead(browsePage, { indexing: true }).robots).toBe('index, follow');
    expect(browsePageHead(browsePage, { indexing: false }).robots).toBe('noindex');
    expect(
      browsePageHead({ segment: 'bikes', makes: [], models: [] }, { indexing: true }).robots,
    ).toBe('noindex');
  });

  it('describes its makes as an ItemList, with no breadcrumbs above the top', () => {
    const head = browsePageHead(
      {
        segment: 'bikes',
        makes: [{ name: 'Royal Enfield', slug: 'royal-enfield', modelCount: 3 }],
        models: [],
      },
      { origin: ORIGIN },
    );

    expect(head.structuredData).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Bikes by make',
      numberOfItems: 1,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Royal Enfield',
          url: `${ORIGIN}/bikes/royal-enfield`,
        },
      ],
    });
  });
});

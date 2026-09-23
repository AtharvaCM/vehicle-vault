import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogModelGeneration,
  type PublicCatalogModelPage,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { modelPageHead, publicModelPath, renderHeadTags } from './public-page-head';

const currentGeneration: PublicCatalogModelGeneration = {
  name: 'Third generation',
  slug: 'third-gen',
  yearStart: 2020,
  yearEnd: null,
  isCurrent: true,
  variants: [
    {
      name: 'Asta',
      slug: 'asta',
      fuelTypes: [FuelType.Petrol],
      yearStart: 2020,
      yearEnd: null,
      isCurrent: true,
      transmission: 'Manual',
    },
    {
      name: 'Asta CNG',
      slug: 'asta-cng',
      fuelTypes: [FuelType.CNG, FuelType.Petrol],
      yearStart: 2022,
      yearEnd: null,
      isCurrent: true,
      transmission: 'Manual',
    },
  ],
};

const olderGeneration: PublicCatalogModelGeneration = {
  name: 'Second generation',
  slug: 'second-gen',
  yearStart: 2014,
  yearEnd: 2020,
  isCurrent: false,
  variants: [
    {
      name: 'Sportz',
      slug: 'sportz',
      fuelTypes: [FuelType.Diesel],
      yearStart: 2014,
      yearEnd: 2020,
      isCurrent: false,
      transmission: null,
    },
  ],
};

function modelPage(overrides: Partial<PublicCatalogModelPage> = {}): PublicCatalogModelPage {
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Hyundai', slug: 'hyundai' },
    model: { name: 'i20', slug: 'i20' },
    generations: [currentGeneration, olderGeneration],
    representative: {
      generation: { name: 'Third generation', slug: 'third-gen' },
      variant: { name: 'Asta', slug: 'asta' },
      specs: null,
    },
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      items: [
        { category: MaintenanceCategory.PeriodicService, km: 10000, months: 12, source: 'default' },
      ],
    },
    indexable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('modelPageHead', () => {
  it('is at the model address, canonical on the custom domain by default', () => {
    const head = modelPageHead(modelPage());

    expect(publicModelPath(modelPage())).toBe('/cars/hyundai/i20');
    expect(head.canonicalUrl).toBe('https://vehicle-vault.middle-earth.in/cars/hyundai/i20');
    expect(
      modelPageHead(modelPage(), { origin: 'https://catalog.example.test/' }).canonicalUrl,
    ).toBe('https://catalog.example.test/cars/hyundai/i20');
  });

  it('names the model in the title', () => {
    expect(modelPageHead(modelPage()).title).toBe(
      'Hyundai i20 — variants, service schedule and specs | Vehicle Vault',
    );
  });

  it('describes how many variants, the years and fuels, and what the schedule asks for', () => {
    expect(modelPageHead(modelPage()).description).toBe(
      'All 3 variants of the Hyundai i20 (2014 – present · Petrol, CNG, Diesel), by generation, ' +
        'with a service schedule and specs. Typical schedule for a petrol car: a periodic service ' +
        'every 10,000 km or 12 months, whichever comes first.',
    );
  });

  it("names the representative variant when the schedule is that variant's own", () => {
    const page = modelPage();
    page.schedule = { ...page.schedule, basis: 'variant' };

    expect(modelPageHead(page).description).toContain(
      'Schedule for the i20 Asta: a periodic service every 10,000 km',
    );
  });

  it('is noindex with the flag off, whatever the gate says', () => {
    expect(modelPageHead(modelPage({ indexable: true }), { indexing: false }).robots).toBe(
      'noindex',
    );
  });

  it('with indexing on, follows the gate', () => {
    expect(modelPageHead(modelPage({ indexable: true }), { indexing: true }).robots).toBe(
      'index, follow',
    );
    expect(modelPageHead(modelPage({ indexable: false }), { indexing: true }).robots).toBe(
      'noindex',
    );
  });

  it('describes the model, not one variant, in its structured data', () => {
    const head = modelPageHead(modelPage(), { origin: 'https://catalog.example.test' });

    expect(head.structuredData).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Car',
      name: 'Hyundai i20',
      url: 'https://catalog.example.test/cars/hyundai/i20',
      brand: { '@type': 'Brand', name: 'Hyundai' },
      model: 'i20',
      fuelType: ['Petrol', 'CNG', 'Diesel'],
      vehicleModelDate: '2014',
    });
  });

  it('makes a bike model a Motorcycle', () => {
    const head = modelPageHead(
      modelPage({
        segment: 'bikes',
        vehicleType: VehicleType.Motorcycle,
        generations: [olderGeneration],
      }),
    );

    expect(head.structuredData).toMatchObject({ '@type': 'Motorcycle', fuelType: 'Diesel' });
  });

  it('escapes catalog names in the rendered tags', () => {
    const tags = renderHeadTags(
      modelPageHead(modelPage({ model: { name: 'i20 <N Line>', slug: 'i20-n-line' } })),
    );

    expect(tags).toContain('<title>Hyundai i20 &lt;N Line&gt;');
    expect(tags).not.toContain('<N Line>');
  });
});

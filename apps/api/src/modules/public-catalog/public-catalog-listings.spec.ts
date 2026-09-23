import {
  buildPublicCatalogBrowsePage,
  buildPublicCatalogMakePage,
  FuelType,
  uniquePublicCatalogVariants,
  VehicleType,
  type PublicCatalogIndexEntry,
} from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

/*
 * The make and browse page builders live in `@vehicle-vault/shared`, which has
 * no test runner; the API is their first caller, so their specs live here.
 */

function entry(
  overrides: Partial<PublicCatalogIndexEntry> & { model: string; variant: string },
): PublicCatalogIndexEntry {
  const { model, variant, ...rest } = overrides;
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Hyundai', slug: 'hyundai' },
    model: { name: model, slug: model.toLowerCase().replace(/\s+/g, '-') },
    generation: { name: `${model} lineup`, slug: `${model.toLowerCase()}-lineup` },
    variant: { name: variant, slug: variant.toLowerCase().replace(/\s+/g, '-') },
    fuelTypes: [FuelType.Petrol],
    yearStart: 2020,
    yearEnd: null,
    isCurrent: true,
    indexable: false,
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...rest,
  };
}

describe('uniquePublicCatalogVariants', () => {
  it('keeps each variant address once, the first entry winning', () => {
    const first = entry({ model: 'Venue', variant: 'S', indexable: false });
    const again = entry({
      model: 'Venue',
      variant: 'S',
      vehicleType: VehicleType.SUV,
      indexable: true,
    });
    const other = entry({ model: 'Venue', variant: 'SX' });

    expect(uniquePublicCatalogVariants([first, again, other])).toEqual([first, other]);
  });
});

describe('buildPublicCatalogMakePage', () => {
  it('merges the models of every make row with the slug, car and SUV alike', () => {
    const page = buildPublicCatalogMakePage(
      [
        entry({ model: 'i20', variant: 'Asta' }),
        entry({ model: 'Creta', variant: 'SX', vehicleType: VehicleType.SUV }),
        entry({ model: 'Venue', variant: 'S' }),
        entry({ model: 'Venue', variant: 'SX', vehicleType: VehicleType.SUV }),
      ],
      'cars',
      'hyundai',
    );

    expect(page?.models.map((model) => [model.name, model.variantCount])).toEqual([
      ['Creta', 1],
      ['i20', 1],
      ['Venue', 2],
    ]);
  });

  it('counts a variant address listed under two make rows once', () => {
    const page = buildPublicCatalogMakePage(
      [
        entry({ model: 'Venue', variant: 'S' }),
        entry({ model: 'Venue', variant: 'S', vehicleType: VehicleType.SUV }),
      ],
      'cars',
      'hyundai',
    );

    expect(page?.models).toEqual([expect.objectContaining({ slug: 'venue', variantCount: 1 })]);
  });

  it('puts models on sale first, then sorts by name as a person would', () => {
    const page = buildPublicCatalogMakePage(
      [
        entry({ model: 'Santro', variant: 'Era', isCurrent: false, yearEnd: 2022 }),
        entry({ model: 'Series 10', variant: 'Base' }),
        entry({ model: 'Series 2', variant: 'Base' }),
        entry({ model: 'alcazar', variant: 'Base' }),
        entry({ model: 'Eon', variant: 'D-Lite', isCurrent: false, yearEnd: 2019 }),
      ],
      'cars',
      'hyundai',
    );

    expect(page?.models.map((model) => model.name)).toEqual([
      'alcazar',
      'Series 2',
      'Series 10',
      'Eon',
      'Santro',
    ]);
  });

  it('sums a model up from its variants: fuels in order, first and last years, on sale', () => {
    const page = buildPublicCatalogMakePage(
      [
        entry({
          model: 'i20',
          variant: 'Magna',
          fuelTypes: [FuelType.Diesel],
          yearStart: 2014,
          yearEnd: 2020,
          isCurrent: false,
        }),
        entry({ model: 'i20', variant: 'Asta', fuelTypes: [FuelType.Petrol, FuelType.CNG] }),
        entry({
          model: 'Santro',
          variant: 'Era',
          isCurrent: false,
          yearStart: 2018,
          yearEnd: 2022,
        }),
        entry({
          model: 'Santro',
          variant: 'Sportz',
          isCurrent: false,
          yearStart: 2019,
          yearEnd: 2021,
        }),
      ],
      'cars',
      'hyundai',
    );

    expect(page?.models).toEqual([
      {
        name: 'i20',
        slug: 'i20',
        variantCount: 2,
        fuelTypes: [FuelType.Diesel, FuelType.Petrol, FuelType.CNG],
        yearStart: 2014,
        yearEnd: null,
        isCurrent: true,
      },
      {
        name: 'Santro',
        slug: 'santro',
        variantCount: 2,
        fuelTypes: [FuelType.Petrol],
        yearStart: 2018,
        yearEnd: 2022,
        isCurrent: false,
      },
    ]);
  });

  it('is indexable when any variant under it is, dated by the newest', () => {
    const entries = [
      entry({ model: 'i20', variant: 'Asta', updatedAt: '2026-07-01T00:00:00.000Z' }),
      entry({ model: 'Creta', variant: 'SX', updatedAt: '2026-09-01T10:00:00.000Z' }),
    ];

    expect(buildPublicCatalogMakePage(entries, 'cars', 'hyundai')).toMatchObject({
      indexable: false,
      updatedAt: '2026-09-01T10:00:00.000Z',
    });
    expect(
      buildPublicCatalogMakePage(
        [...entries, entry({ model: 'Venue', variant: 'S', indexable: true })],
        'cars',
        'hyundai',
      ),
    ).toMatchObject({ indexable: true });
  });

  it('ignores the variant a make row repeats, for the verdict too', () => {
    const page = buildPublicCatalogMakePage(
      [
        entry({ model: 'Venue', variant: 'S', indexable: false }),
        entry({ model: 'Venue', variant: 'S', vehicleType: VehicleType.SUV, indexable: true }),
      ],
      'cars',
      'hyundai',
    );

    expect(page?.indexable).toBe(false);
  });

  it('keeps to its segment and make, and is null with nothing there', () => {
    const entries = [
      entry({ model: 'i20', variant: 'Asta' }),
      entry({ model: 'City', variant: 'V', make: { name: 'Honda', slug: 'honda' } }),
      entry({
        model: 'Shine',
        variant: 'Drum',
        segment: 'bikes',
        vehicleType: VehicleType.Motorcycle,
        make: { name: 'Honda', slug: 'honda' },
      }),
    ];

    expect(
      buildPublicCatalogMakePage(entries, 'cars', 'honda')?.models.map((model) => model.slug),
    ).toEqual(['city']);
    expect(
      buildPublicCatalogMakePage(entries, 'bikes', 'honda')?.models.map((model) => model.slug),
    ).toEqual(['shine']);
    expect(buildPublicCatalogMakePage(entries, 'bikes', 'hyundai')).toBeNull();
  });
});

describe('buildPublicCatalogBrowsePage', () => {
  it('lists each make once by name, with how many models it has across its rows', () => {
    const page = buildPublicCatalogBrowsePage(
      [
        entry({ model: 'i20', variant: 'Asta' }),
        entry({ model: 'i20', variant: 'Sportz' }),
        entry({ model: 'Creta', variant: 'SX', vehicleType: VehicleType.SUV }),
        entry({ model: 'City', variant: 'V', make: { name: 'Honda', slug: 'honda' } }),
        entry({
          model: 'Classic 350',
          variant: 'Chrome',
          segment: 'bikes',
          vehicleType: VehicleType.Motorcycle,
          make: { name: 'Royal Enfield', slug: 'royal-enfield' },
        }),
      ],
      'cars',
    );

    expect(page).toEqual({
      segment: 'cars',
      makes: [
        { name: 'Honda', slug: 'honda', modelCount: 1 },
        { name: 'Hyundai', slug: 'hyundai', modelCount: 2 },
      ],
    });
  });

  it('is empty for a segment with nothing in it', () => {
    expect(
      buildPublicCatalogBrowsePage([entry({ model: 'i20', variant: 'Asta' })], 'bikes'),
    ).toEqual({ segment: 'bikes', makes: [] });
  });
});

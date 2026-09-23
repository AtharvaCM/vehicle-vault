import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogSpec,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildSpecSections } from '../components/public-spec-sections';
import { PublicVariantPageView, variantPageTitle } from './public-variant-page';

const emptySpecs: PublicCatalogSpec = {
  engineCc: null,
  engineCyl: null,
  engineType: null,
  engineFuel: null,
  powerPs: null,
  powerRpm: null,
  torqueNm: null,
  torqueRpm: null,
  transmission: null,
  driveType: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  wheelbaseMm: null,
  kerbWeightKg: null,
  bootSpaceLitres: null,
  groundClearanceMm: null,
  topSpeedKph: null,
  mileageCity: null,
  mileageHighway: null,
  mileageCombined: null,
  fuelCapLitres: null,
  seatingCapacity: null,
  bodyType: null,
  doors: null,
  tyreSize: null,
  wheelSizeInch: null,
  airbagCount: null,
  ncapStarsAdult: null,
  ncapStarsChild: null,
  ncapRegion: null,
  hasAbs: null,
  hasEsc: null,
  batteryKwh: null,
  rangeKm: null,
  motorKw: null,
  acChargeKw: null,
  dcFastChargeKw: null,
  chargeTime0To80Min: null,
  gearCount: null,
  coolingType: null,
  seatHeightMm: null,
  brakeFrontType: null,
  brakeRearType: null,
  absChannels: null,
};

function pageFixture(overrides: Partial<PublicCatalogVariantPage> = {}): PublicCatalogVariantPage {
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
    specs: { ...emptySpecs, engineCc: 1197, powerPs: 83, powerRpm: 6000, transmission: 'Manual' },
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      items: [
        {
          category: MaintenanceCategory.PeriodicService,
          km: 10000,
          months: 12,
          source: 'default',
        },
        { category: MaintenanceCategory.EngineOil, km: 7500, months: 6, source: 'default' },
      ],
    },
    calculatorSeed: {
      fuelType: FuelType.Petrol,
      claimedMileage: 20.3,
      claimedRangeKm: null,
      batteryKwh: null,
    },
    indexable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('PublicVariantPageView', () => {
  it('names the variant and what it was offered as', () => {
    render(<PublicVariantPageView page={pageFixture()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hyundai i20 Asta' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Offered' })).getByText('2023 – present · Petrol'),
    ).toBeInTheDocument();
    expect(document.title).toBe(variantPageTitle(pageFixture()));
  });

  it('has breadcrumbs up to its model, make and browse pages, ending on itself', () => {
    render(<PublicVariantPageView page={pageFixture()} />);
    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

    expect(
      trail.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Cars', '/cars'],
      ['Hyundai', '/cars/hyundai'],
      ['i20', '/cars/hyundai/i20'],
    ]);
    expect(trail.getByText('Asta')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('i20 lineup')).toBeInTheDocument();
  });

  it('labels a default schedule as typical and lists each item with its interval', () => {
    render(<PublicVariantPageView page={pageFixture()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Typical schedule for a petrol car' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Periodic service')).toBeInTheDocument();
    expect(
      screen.getByText('Every 10,000 km or 12 months, whichever comes first'),
    ).toBeInTheDocument();
    expect(screen.getByText('Engine oil')).toBeInTheDocument();
  });

  it("labels a schedule with the variant's own intervals as the variant's", () => {
    const page = pageFixture();
    page.schedule = { ...page.schedule, basis: 'variant' };
    render(<PublicVariantPageView page={page} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'This variant’s schedule' }),
    ).toBeInTheDocument();
  });

  it('shows the specs it has and leaves out the ones it lacks, without blanks', () => {
    render(<PublicVariantPageView page={pageFixture()} />);

    const engine = screen.getByRole('region', { name: 'Engine and drivetrain' });
    expect(within(engine).getByText('1,197 cc')).toBeInTheDocument();
    expect(within(engine).getByText('83 PS @ 6,000 rpm')).toBeInTheDocument();
    expect(within(engine).queryByText('Cylinders')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Dimensions' })).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('drops the specifications section entirely when the variant has none', () => {
    render(<PublicVariantPageView page={pageFixture({ specs: null })} />);

    expect(screen.queryByRole('heading', { name: 'Specifications' })).not.toBeInTheDocument();
  });
});

describe('buildSpecSections', () => {
  it('returns nothing for a spec row with every field empty', () => {
    expect(buildSpecSections(emptySpecs)).toEqual([]);
  });

  it('keeps a false boolean, which is a fact, and drops a blank string, which is not', () => {
    const sections = buildSpecSections({ ...emptySpecs, hasAbs: false, tyreSize: '  ' });

    expect(sections).toEqual([{ title: 'Safety', rows: [['ABS', false]] }]);
  });
});

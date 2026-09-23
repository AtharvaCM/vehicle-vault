import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogModelPage,
  type PublicCatalogSpec,
} from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { modelPageTitle, PublicModelPageView } from './public-model-page';

function modelPage(overrides: Partial<PublicCatalogModelPage> = {}): PublicCatalogModelPage {
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Hyundai', slug: 'hyundai' },
    model: { name: 'i20', slug: 'i20' },
    generations: [
      {
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
            name: 'Era',
            slug: 'era',
            fuelTypes: [FuelType.Petrol, FuelType.CNG],
            yearStart: 2020,
            yearEnd: 2022,
            isCurrent: false,
            transmission: null,
          },
        ],
      },
      {
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
      },
    ],
    representative: {
      generation: { name: 'Third generation', slug: 'third-gen' },
      variant: { name: 'Asta', slug: 'asta' },
      specs: { engineCc: 1197, powerPs: 83, transmission: 'Manual' } as PublicCatalogSpec,
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

// Rendered with no router and no providers, as a prerender may render it.
describe('PublicModelPageView', () => {
  it('names the model and sums it up', () => {
    render(<PublicModelPageView page={modelPage()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hyundai i20' })).toBeInTheDocument();
    expect(
      screen.getByText('3 variants · Petrol, CNG, Diesel · 2014 – present'),
    ).toBeInTheDocument();
    expect(document.title).toBe(modelPageTitle(modelPage()));
  });

  it('lists the variants by generation, current first, each linking to its own page', () => {
    render(<PublicModelPageView page={modelPage()} />);

    const variants = screen.getByRole('region', { name: 'Variants' });
    const generations = within(variants)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(generations).toEqual(['Third generation', 'Second generation']);

    const current = screen.getByRole('region', { name: 'Third generation' });
    expect(within(current).getByText('Current')).toBeInTheDocument();
    expect(within(current).getByText('2020 – present')).toBeInTheDocument();
    const links = within(current).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/cars/hyundai/i20/third-gen/asta',
      '/cars/hyundai/i20/third-gen/era',
    ]);
    expect(within(links[0]!).getByText('Hyundai i20 Asta')).toBeInTheDocument();
    expect(within(links[0]!).getByText('Petrol · Manual · 2020 – present')).toBeInTheDocument();
    expect(within(links[1]!).getByText('Petrol, CNG · 2020 – 2022')).toBeInTheDocument();

    const older = screen.getByRole('region', { name: 'Second generation' });
    expect(within(older).queryByText('Current')).not.toBeInTheDocument();
    expect(within(older).getByRole('link')).toHaveAttribute(
      'href',
      '/cars/hyundai/i20/second-gen/sportz',
    );
  });

  it('gives a current generation with no years only its Current badge', () => {
    const page = modelPage();
    page.generations[0] = { ...page.generations[0]!, yearStart: null, yearEnd: null };
    render(<PublicModelPageView page={page} />);

    const current = screen.getByRole('region', { name: 'Third generation' });
    expect(within(current).getByText('Current')).toBeInTheDocument();
    expect(within(current).queryByText('On sale now')).not.toBeInTheDocument();
  });

  it('says whose schedule and specs it shows', () => {
    render(<PublicModelPageView page={modelPage()} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Typical schedule for a petrol car' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Shown for the Hyundai i20 Asta. Each variant’s page has its own.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Specifications of the Hyundai i20 Asta' }),
    ).toBeInTheDocument();
    const engine = screen.getByRole('region', { name: 'Engine and drivetrain' });
    expect(within(engine).getByText('1,197 cc')).toBeInTheDocument();
  });

  it("names a variant-specific schedule after its variant, not as the model's", () => {
    const page = modelPage();
    page.schedule = { ...page.schedule, basis: 'variant' };
    render(<PublicModelPageView page={page} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Schedule for the i20 Asta' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('This variant’s schedule')).not.toBeInTheDocument();
  });

  it('drops the specifications when the representative variant has none', () => {
    render(
      <PublicModelPageView
        page={modelPage({ representative: { ...modelPage().representative, specs: null } })}
      />,
    );

    expect(screen.queryByRole('heading', { name: /^Specifications/ })).not.toBeInTheDocument();
  });

  it('offers to track the model, carrying make and model only', () => {
    render(<PublicModelPageView page={modelPage()} />);

    expect(screen.getByRole('heading', { name: 'Own a Hyundai i20?' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /track this vehicle/i })).toHaveAttribute(
      'href',
      `/register?catalog=${encodeURIComponent('/cars/hyundai/i20')}`,
    );
  });

  it('links a bike model’s variants under /bikes', () => {
    render(
      <PublicModelPageView
        page={modelPage({
          segment: 'bikes',
          vehicleType: VehicleType.Motorcycle,
          make: { name: 'Royal Enfield', slug: 'royal-enfield' },
          model: { name: 'Classic 350', slug: 'classic-350' },
        })}
      />,
    );

    expect(screen.getByRole('link', { name: /Royal Enfield Classic 350 Asta/ })).toHaveAttribute(
      'href',
      '/bikes/royal-enfield/classic-350/third-gen/asta',
    );
  });
});

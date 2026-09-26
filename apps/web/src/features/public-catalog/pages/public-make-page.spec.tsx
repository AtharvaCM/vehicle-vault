import { FuelType, type PublicCatalogMakePage } from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makePageTitle, PublicMakePageView } from './public-make-page';

function makePage(overrides: Partial<PublicCatalogMakePage> = {}): PublicCatalogMakePage {
  return {
    segment: 'cars',
    make: { name: 'Hyundai', slug: 'hyundai' },
    otherSegment: null,
    models: [
      {
        name: 'Creta',
        slug: 'creta',
        variantCount: 14,
        fuelTypes: [FuelType.Petrol, FuelType.Diesel],
        yearStart: 2015,
        yearEnd: null,
        isCurrent: true,
      },
      {
        name: 'i20',
        slug: 'i20',
        variantCount: 1,
        fuelTypes: [FuelType.Petrol],
        yearStart: 2020,
        yearEnd: null,
        isCurrent: true,
      },
      {
        name: 'Santro',
        slug: 'santro',
        variantCount: 3,
        fuelTypes: [FuelType.Petrol, FuelType.CNG],
        yearStart: 2018,
        yearEnd: 2022,
        isCurrent: false,
      },
    ],
    indexable: false,
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

// Rendered with no router and no providers, as a prerender may render it.
describe('PublicMakePageView', () => {
  it('names the make and the segment, and counts its models', () => {
    render(<PublicMakePageView page={makePage()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Hyundai cars' })).toBeInTheDocument();
    expect(screen.getByText(/^3 models\./)).toBeInTheDocument();
    expect(document.title).toBe(makePageTitle(makePage()));
  });

  it('lists the models on sale, then those no longer sold, each linking to its page', () => {
    render(<PublicMakePageView page={makePage()} />);

    const onSale = screen.getByRole('region', { name: 'On sale' });
    expect(
      within(onSale)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Hyundai Creta Petrol, Diesel · 2015 – present · 14 variants', '/cars/hyundai/creta'],
      ['Hyundai i20 Petrol · 2020 – present · 1 variant', '/cars/hyundai/i20'],
    ]);
    const earlier = screen.getByRole('region', { name: 'No longer sold' });
    expect(within(earlier).getByRole('link')).toHaveAttribute('href', '/cars/hyundai/santro');
    expect(within(earlier).getByText('Petrol, CNG · 2018 – 2022 · 3 variants')).toBeInTheDocument();
  });

  it('offers an owner of the make to track theirs', () => {
    render(<PublicMakePageView page={makePage()} />);

    const offer = screen.getByRole('region', { name: 'Own a Hyundai?' });
    expect(within(offer).getByRole('link', { name: 'Track your Hyundai' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('lists every model under one heading when none is on sale', () => {
    const page = makePage();
    render(
      <PublicMakePageView
        page={{ ...page, models: page.models.map((model) => ({ ...model, isCurrent: false })) }}
      />,
    );

    expect(screen.queryByRole('region', { name: 'On sale' })).toBeNull();
    expect(
      within(screen.getByRole('region', { name: 'Models' })).getAllByRole('link'),
    ).toHaveLength(3);
  });

  it('has breadcrumbs up to the browse page, ending on itself', () => {
    render(<PublicMakePageView page={makePage({ segment: 'bikes' })} />);
    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));

    expect(trail.getByRole('link', { name: 'Bikes' })).toHaveAttribute('href', '/bikes');
    expect(trail.getByText('Hyundai')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Hyundai bikes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hyundai Creta/ })).toHaveAttribute(
      'href',
      '/bikes/hyundai/creta',
    );
  });

  it('links the same make’s other segment when it has pages there, and says when it was updated', () => {
    render(<PublicMakePageView page={makePage({ otherSegment: 'bikes' })} />);

    expect(screen.getByRole('link', { name: 'Hyundai bikes' })).toHaveAttribute(
      'href',
      '/bikes/hyundai',
    );
    expect(screen.getByTestId('catalog-freshness')).toHaveTextContent('Details last updated');
  });

  it('offers no other segment when there is none', () => {
    render(<PublicMakePageView page={makePage()} />);
    expect(screen.queryByText(/makes bikes too/)).toBeNull();
  });
});

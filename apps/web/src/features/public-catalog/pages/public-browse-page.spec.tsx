import type { PublicCatalogBrowseModel, PublicCatalogBrowsePage } from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { browsePageTitle, PublicBrowsePageView } from './public-browse-page';

const HONDA = { name: 'Honda', slug: 'honda' };
const HYUNDAI = { name: 'Hyundai', slug: 'hyundai' };

function model(
  make: { name: string; slug: string },
  name: string,
  isCurrent = true,
): PublicCatalogBrowseModel {
  return {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    make,
    variantCount: 3,
    isCurrent,
  };
}

const carsPage: PublicCatalogBrowsePage = {
  segment: 'cars',
  makes: [
    { name: 'Honda', slug: 'honda', modelCount: 2 },
    { name: 'Hyundai', slug: 'hyundai', modelCount: 1 },
  ],
  models: [model(HONDA, 'City'), model(HONDA, 'City ZX', false), model(HYUNDAI, 'Creta')],
};

// Rendered with no router and no providers, as a prerender may render it.
describe('PublicBrowsePageView', () => {
  it('says how much the catalog holds, and tiles every make with its model count', () => {
    render(<PublicBrowsePageView page={carsPage} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cars in India' })).toBeInTheDocument();
    expect(
      screen.getByText('Service intervals and running costs for 3 models from 2 makers.'),
    ).toBeInTheDocument();
    const makes = screen.getByRole('region', { name: 'Makes' });
    expect(
      within(makes)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Honda2 models', '/cars/honda'],
      ['Hyundai1 model', '/cars/hyundai'],
    ]);
    expect(document.title).toBe(browsePageTitle(carsPage));
  });

  it('offers the popular models the catalog has, and nothing it lacks', () => {
    render(<PublicBrowsePageView page={carsPage} />);

    const popular = screen.getByRole('region', { name: 'Popular models' });
    expect(
      within(popular)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/cars/hyundai/creta', '/cars/honda/city']);
  });

  it('finds makes and models, those on sale first', async () => {
    const user = userEvent.setup();
    render(<PublicBrowsePageView page={carsPage} />);

    await user.type(screen.getByLabelText('Search makes and models'), 'city');
    expect(
      within(screen.getByRole('list', { name: 'Matches' }))
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Honda City On sale', '/cars/honda/city'],
      ['Honda City ZX No longer sold', '/cars/honda/city-zx'],
    ]);

    await user.clear(screen.getByLabelText('Search makes and models'));
    await user.type(screen.getByLabelText('Search makes and models'), 'hyundaicreta');
    expect(
      within(screen.getByRole('list', { name: 'Matches' })).getByRole('link', {
        name: /Hyundai Creta/,
      }),
    ).toHaveAttribute('href', '/cars/hyundai/creta');

    await user.clear(screen.getByLabelText('Search makes and models'));
    await user.type(screen.getByLabelText('Search makes and models'), 'zzz');
    expect(screen.getByText(/Nothing matches “zzz” yet/)).toBeInTheDocument();
  });

  it('offers to track your own, signed out to registration', () => {
    render(<PublicBrowsePageView page={carsPage} />);

    const offer = screen.getByRole('region', { name: 'Own one already?' });
    expect(within(offer).getByRole('link', { name: 'Track your vehicle' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('switches segment with one Cars / Bikes control', () => {
    render(<PublicBrowsePageView page={carsPage} />);
    const segments = within(screen.getByRole('navigation', { name: 'Cars or bikes' }));
    expect(segments.getByRole('link', { name: 'Cars' })).toHaveAttribute('href', '/cars');
    expect(segments.getByRole('link', { name: 'Bikes' })).toHaveAttribute('href', '/bikes');
  });

  it('lists bike makes under /bikes, and has no breadcrumbs above the top', () => {
    render(
      <PublicBrowsePageView
        page={{
          segment: 'bikes',
          makes: [{ name: 'Royal Enfield', slug: 'royal-enfield', modelCount: 1 }],
          models: [model({ name: 'Royal Enfield', slug: 'royal-enfield' }, 'Classic 350')],
        }}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Bikes in India' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Makes' })).getByRole('link', {
        name: /Royal Enfield/,
      }),
    ).toHaveAttribute('href', '/bikes/royal-enfield');
    expect(screen.getByRole('link', { name: 'Cars' })).toHaveAttribute('href', '/cars');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('says so, rather than showing an empty list, when a segment has nothing yet', () => {
    render(<PublicBrowsePageView page={{ segment: 'bikes', makes: [], models: [] }} />);

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Makes' })).toBeNull();
    expect(screen.queryByLabelText('Search makes and models')).toBeNull();
  });
});

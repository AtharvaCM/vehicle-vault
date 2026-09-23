import type { PublicCatalogBrowsePage } from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { browsePageTitle, PublicBrowsePageView } from './public-browse-page';

const carsPage: PublicCatalogBrowsePage = {
  segment: 'cars',
  makes: [
    { name: 'Honda', slug: 'honda', modelCount: 6 },
    { name: 'Hyundai', slug: 'hyundai', modelCount: 1 },
  ],
};

// Rendered with no router and no providers, as a prerender may render it.
describe('PublicBrowsePageView', () => {
  it('lists every make, each linking to its make page with its model count', () => {
    render(<PublicBrowsePageView page={carsPage} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cars by make' })).toBeInTheDocument();
    const makes = screen.getByRole('region', { name: 'Makes' });
    expect(
      within(makes)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Honda6 models', '/cars/honda'],
      ['Hyundai1 model', '/cars/hyundai'],
    ]);
    expect(document.title).toBe(browsePageTitle(carsPage));
  });

  it('points a visitor on the wrong segment at the other one', () => {
    render(<PublicBrowsePageView page={carsPage} />);
    expect(screen.getByRole('link', { name: 'Browse bikes' })).toHaveAttribute('href', '/bikes');
  });

  it('lists bike makes under /bikes, and has no breadcrumbs above the top', () => {
    render(
      <PublicBrowsePageView
        page={{
          segment: 'bikes',
          makes: [{ name: 'Royal Enfield', slug: 'royal-enfield', modelCount: 3 }],
        }}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Bikes by make' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Royal Enfield/ })).toHaveAttribute(
      'href',
      '/bikes/royal-enfield',
    );
    expect(screen.getByRole('link', { name: 'Browse cars' })).toHaveAttribute('href', '/cars');
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('says so, rather than showing an empty list, when a segment has nothing yet', () => {
    render(<PublicBrowsePageView page={{ segment: 'bikes', makes: [] }} />);

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Makes' })).toBeNull();
  });
});

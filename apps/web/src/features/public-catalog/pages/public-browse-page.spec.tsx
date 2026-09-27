import type {
  CarBodyType,
  PublicCatalogBrowseModel,
  PublicCatalogBrowsePage,
} from '@vehicle-vault/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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

  describe('body-type chips (#389)', () => {
    const TATA = { name: 'Tata', slug: 'tata' };
    const shaped = (
      make: { name: string; slug: string },
      name: string,
      bodyType: CarBodyType | null,
      isCurrent = true,
    ) => ({ ...model(make, name, isCurrent), bodyType });
    const shapedPage: PublicCatalogBrowsePage = {
      segment: 'cars',
      makes: [
        { name: 'Honda', slug: 'honda', modelCount: 3 },
        { name: 'Hyundai', slug: 'hyundai', modelCount: 3 },
        { name: 'Tata', slug: 'tata', modelCount: 4 },
      ],
      models: [
        shaped(HONDA, 'City', 'Sedan'),
        shaped(HONDA, 'Amaze', 'Sedan'),
        shaped(HONDA, 'Elevate', 'SUV'),
        shaped(HYUNDAI, 'Creta', 'SUV'),
        shaped(HYUNDAI, 'Verna', 'Sedan'),
        shaped(HYUNDAI, 'i20', 'Hatchback'),
        shaped(TATA, 'Safari', 'SUV', false),
        shaped(TATA, 'Nexon', 'SUV'),
        shaped(TATA, 'Tiago', 'Hatchback'),
        shaped(TATA, 'Nano', 'Hatchback'),
      ],
    };

    it('offers a chip per well-covered body type, with its model count', () => {
      render(<PublicBrowsePageView page={shapedPage} />);

      const chips = within(screen.getByRole('group', { name: 'Body type' })).getAllByRole('button');
      expect(chips.map((chip) => chip.textContent)).toEqual(['Hatchback 3', 'Sedan 3', 'SUV 4']);
      expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
    });

    it('lists the selected body type’s models, on sale first, and clears on a second tap', async () => {
      const user = userEvent.setup();
      render(<PublicBrowsePageView page={shapedPage} />);

      await user.click(screen.getByRole('button', { name: 'SUV 4' }));
      expect(screen.getByRole('button', { name: 'SUV 4' })).toHaveAttribute('aria-pressed', 'true');
      expect(
        within(screen.getByRole('list', { name: 'SUVs' }))
          .getAllByRole('link')
          .map((link) => link.getAttribute('href')),
      ).toEqual([
        '/cars/honda/elevate',
        '/cars/hyundai/creta',
        '/cars/tata/nexon',
        '/cars/tata/safari',
      ]);

      await user.click(screen.getByRole('button', { name: 'SUV 4' }));
      expect(screen.queryByRole('list', { name: 'SUVs' })).toBeNull();
    });

    it('takes the selection from the route, and reports taps back to it', async () => {
      const user = userEvent.setup();
      const onBodyTypeChange = vi.fn();
      render(
        <PublicBrowsePageView
          bodyType="sedan"
          onBodyTypeChange={onBodyTypeChange}
          page={shapedPage}
        />,
      );

      expect(screen.getByRole('list', { name: 'Sedans' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Hatchback 3' }));
      expect(onBodyTypeChange).toHaveBeenCalledWith('hatchback');
      await user.click(screen.getByRole('button', { name: 'Sedan 3' }));
      expect(onBodyTypeChange).toHaveBeenLastCalledWith(null);
    });

    it('ignores a body type in the URL that has no chip', () => {
      render(
        <PublicBrowsePageView bodyType="coupe" onBodyTypeChange={vi.fn()} page={shapedPage} />,
      );

      expect(screen.getByRole('group', { name: 'Body type' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: /s$/ })).toBeNull();
    });

    it('offers no chips while too few models have a body type', () => {
      render(
        <PublicBrowsePageView
          page={{
            ...shapedPage,
            models: shapedPage.models.map((entry, index) =>
              index < 2 ? { ...entry, bodyType: null } : entry,
            ),
          }}
        />,
      );

      expect(screen.queryByRole('group', { name: 'Body type' })).toBeNull();
    });
  });

  it('says so, rather than showing an empty list, when a segment has nothing yet', () => {
    render(<PublicBrowsePageView page={{ segment: 'bikes', makes: [], models: [] }} />);

    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Makes' })).toBeNull();
    expect(screen.queryByLabelText('Search makes and models')).toBeNull();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FindYourVehicle } from './find-your-vehicle';

const MAKES = {
  cars: [
    { slug: 'honda', name: 'Honda', modelCount: 3 },
    { slug: 'maruti-suzuki', name: 'Maruti Suzuki', modelCount: 12 },
    { slug: 'tata', name: 'Tata', modelCount: 1 },
  ],
  bikes: [
    { slug: 'honda', name: 'Honda', modelCount: 5 },
    { slug: 'royal-enfield', name: 'Royal Enfield', modelCount: 4 },
  ],
};

vi.mock('@/features/public-catalog/api/use-public-browse-page', () => ({
  usePublicBrowsePage: (segment: 'cars' | 'bikes') => ({
    data: { segment, makes: MAKES[segment] },
  }),
}));

describe('FindYourVehicle', () => {
  it('offers the popular makes the catalog has, saying which Honda', () => {
    render(<FindYourVehicle />);

    expect(screen.getByRole('link', { name: 'Maruti Suzuki' })).toHaveAttribute(
      'href',
      '/cars/maruti-suzuki',
    );
    expect(screen.getByRole('link', { name: 'Honda bikes' })).toHaveAttribute(
      'href',
      '/bikes/honda',
    );
    expect(screen.getByRole('link', { name: 'Royal Enfield' })).toHaveAttribute(
      'href',
      '/bikes/royal-enfield',
    );
    // Not in the catalog here: no chip that would lead nowhere.
    expect(screen.queryByRole('link', { name: 'Hero' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All cars' })).toHaveAttribute('href', '/cars');
    expect(screen.getByRole('link', { name: 'All bikes' })).toHaveAttribute('href', '/bikes');
  });

  it('finds makes of cars and bikes by name', async () => {
    const user = userEvent.setup();
    render(<FindYourVehicle />);

    await user.type(screen.getByLabelText('Search a make'), 'hon');
    const matches = within(screen.getByRole('list', { name: 'Makes that match' }));
    expect(matches.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/cars/honda',
      '/bikes/honda',
    ]);
    expect(matches.getByRole('link', { name: /Honda Bikes · 5 models/ })).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search a make'));
    await user.type(screen.getByLabelText('Search a make'), 'tata');
    expect(screen.getByRole('link', { name: /Tata Cars · 1 model$/ })).toBeInTheDocument();
  });

  it('says so when nothing matches, and points at the full lists', async () => {
    const user = userEvent.setup();
    render(<FindYourVehicle />);

    await user.type(screen.getByLabelText('Search a make'), 'lamborghini');
    expect(screen.getByText(/No make matches “lamborghini” yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cars' })).toHaveAttribute('href', '/cars');
  });
});

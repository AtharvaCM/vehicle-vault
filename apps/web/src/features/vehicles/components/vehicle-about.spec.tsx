import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleRole, VehicleType } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const specsQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../hooks/use-variant-specs', () => ({
  useVariantSpecs: () => specsQuery.current,
}));

import { VehicleAccessProvider } from '../context/vehicle-access';
import type { Vehicle } from '../types/vehicle';
import { VehicleAbout } from './vehicle-about';

const virtus: Vehicle = {
  id: 'vehicle-1',
  registrationNumber: 'MH12AB1234',
  make: 'Volkswagen',
  model: 'Virtus',
  variant: 'GT Plus',
  year: 2024,
  fuelType: FuelType.Petrol,
  vehicleType: VehicleType.Car,
  odometer: 18_500,
  purchaseDate: '2024-03-12T00:00:00.000Z',
  purchasePrice: 1_890_000,
  purchaseOdometer: 12,
  createdAt: '2024-03-12T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const gtPlusSpecs = {
  id: 'spec-1',
  variantId: 'variant-1',
  tyreSize: '205/55 R16',
  fuelCapLitres: 45,
  engineCc: 1498,
  engineFuel: 'Petrol',
  transmission: '7-speed DSG',
  powerPs: 150,
};

function renderAbout(vehicle: Vehicle, role: VehicleRole = VehicleRole.Owner) {
  return render(
    <VehicleAccessProvider role={role}>
      <VehicleAbout vehicle={vehicle} />
    </VehicleAccessProvider>,
  );
}

describe('VehicleAbout', () => {
  beforeEach(() => {
    specsQuery.current = { isPending: false, isError: false, data: gtPlusSpecs };
  });

  it('shows the variant, the key specs as one line, and the purchase', () => {
    renderAbout(virtus);

    expect(screen.getByText('GT Plus')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change' })).toHaveAttribute(
      'href',
      '/vehicles/$vehicleId/edit',
    );
    expect(screen.getByTestId('about-specs')).toHaveTextContent(
      'Tyres 205/55 R16 · Tank 45 L · 1,498 cc petrol · 7-speed DSG',
    );
    expect(screen.getByTestId('about-bought')).toHaveTextContent(
      '12 Mar 2024 · ₹18,90,000 · at 12 km',
    );
    expect(within(screen.getByTestId('about-bought')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('opens the full spec sheet under the summary', async () => {
    renderAbout(virtus);
    const toggle = screen.getByRole('button', { name: 'Full spec sheet' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('spec-sheet')).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Engine & drivetrain')).toBeInTheDocument();
  });

  it('says in one line when the catalogue has no specs for the variant', () => {
    specsQuery.current = { isPending: false, isError: false, data: null };
    renderAbout(virtus);

    const row = within(screen.getByTestId('about-specs'));
    expect(row.getByText("We don't have specs for this variant yet")).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'Pick a variant' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Full spec sheet' })).not.toBeInTheDocument();
  });

  it('asks for a variant when none is on file, without looking anything up', () => {
    // The lookup is keyed by variant, so it never runs and stays pending.
    specsQuery.current = { isPending: true, isError: false, data: undefined };
    renderAbout({ ...virtus, variant: undefined });

    expect(screen.getByText('Not picked for this Volkswagen Virtus')).toBeInTheDocument();
    expect(screen.getByText('Pick the variant to see its specs')).toBeInTheDocument();
    expect(screen.queryByText('Looking up the specs…')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Pick a variant' })).toHaveLength(2);
  });

  it('offers to add the purchase when it is missing', () => {
    renderAbout({ ...virtus, purchaseDate: null, purchasePrice: null, purchaseOdometer: null });

    const row = within(screen.getByTestId('about-bought'));
    expect(row.getByText('No purchase date or price yet')).toBeInTheDocument();
    expect(row.getByRole('link', { name: 'Add purchase date & price' })).toBeInTheDocument();
  });

  it('shows the engine oil the owner recorded, or offers to add it (#332)', () => {
    const { unmount } = renderAbout({ ...virtus, engineOilGrade: '5W-30', engineOilLitres: 3.8 });
    const recorded = within(screen.getByTestId('about-engine-oil'));
    expect(recorded.getByText('5W-30 · 3.8 L')).toBeInTheDocument();
    expect(recorded.getByRole('link', { name: 'Change' })).toBeInTheDocument();
    unmount();

    renderAbout(virtus);
    expect(
      within(screen.getByTestId('about-engine-oil')).getByRole('link', { name: 'Add engine oil' }),
    ).toBeInTheDocument();
  });

  it('gives a viewer no edits', () => {
    specsQuery.current = { isPending: false, isError: false, data: null };
    renderAbout({ ...virtus, purchaseDate: null, purchasePrice: null }, VehicleRole.Viewer);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers a retry when the lookup fails', async () => {
    const refetch = vi.fn();
    specsQuery.current = { isPending: false, isError: true, data: undefined, refetch };
    renderAbout(virtus);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

import { render, screen } from '@testing-library/react';
import {
  VehicleType,
  type PublicCatalogModelPage,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '@/features/auth/providers/auth-provider';
import type { AppAuthContextValue } from '@/features/auth/types/auth-session';

import { TrackThisVehicle } from './track-this-vehicle';

const page = {
  segment: 'cars',
  vehicleType: VehicleType.Car,
  make: { name: 'Honda', slug: 'honda' },
  model: { name: 'City', slug: 'city' },
  generation: { name: 'City lineup', slug: 'city-lineup' },
  variant: { name: 'VX CVT', slug: 'vx-cvt' },
} as unknown as PublicCatalogVariantPage;

const intentQuery = `catalog=${encodeURIComponent('/cars/honda/city/city-lineup/vx-cvt')}`;

function cta() {
  return screen.getByRole('link', { name: /track this vehicle/i });
}

// Rendered with no router and no auth provider, as a prerender may render it.
describe('TrackThisVehicle', () => {
  it('sends a signed-out visitor to registration, carrying the variant', () => {
    render(<TrackThisVehicle page={page} />);

    expect(screen.getByRole('heading', { name: 'Own a Honda City VX CVT?' })).toBeInTheDocument();
    expect(cta()).toHaveAttribute('href', `/register?${intentQuery}`);
  });

  it('sends a signed-in visitor straight to the add-vehicle form', () => {
    render(
      <AuthContext.Provider value={{ isAuthenticated: true } as AppAuthContextValue}>
        <TrackThisVehicle page={page} />
      </AuthContext.Provider>,
    );

    expect(cta()).toHaveAttribute('href', `/vehicles/new?${intentQuery}`);
  });

  it('carries only make and model from a model page, leaving the variant to the owner', () => {
    const modelPage = {
      segment: 'cars',
      vehicleType: VehicleType.Car,
      make: { name: 'Honda', slug: 'honda' },
      model: { name: 'City', slug: 'city' },
      generations: [],
    } as unknown as PublicCatalogModelPage;
    const modelQuery = `catalog=${encodeURIComponent('/cars/honda/city')}`;

    const { unmount } = render(<TrackThisVehicle page={modelPage} />);

    expect(screen.getByRole('heading', { name: 'Own a Honda City?' })).toBeInTheDocument();
    expect(screen.getByText(/fill in the make and model for you/)).toBeInTheDocument();
    expect(cta()).toHaveAttribute('href', `/register?${modelQuery}`);
    unmount();

    render(
      <AuthContext.Provider value={{ isAuthenticated: true } as AppAuthContextValue}>
        <TrackThisVehicle page={modelPage} />
      </AuthContext.Provider>,
    );
    expect(cta()).toHaveAttribute('href', `/vehicles/new?${modelQuery}`);
  });

  it('leaves storage alone while rendering', () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem');
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    render(<TrackThisVehicle page={page} />);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

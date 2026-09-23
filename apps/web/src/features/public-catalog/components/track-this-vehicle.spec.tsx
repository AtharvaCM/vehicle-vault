import { render, screen } from '@testing-library/react';
import { VehicleType, type PublicCatalogVariantPage } from '@vehicle-vault/shared';
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

  it('leaves storage alone while rendering', () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem');
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    render(<TrackThisVehicle page={page} />);

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

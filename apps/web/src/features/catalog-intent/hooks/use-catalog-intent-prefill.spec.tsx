import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { FuelType, VehicleType, type PublicCatalogVariantPage } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

const navigate = vi.hoisted(() => vi.fn());
const getPublicVariantPage = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@/features/public-catalog/api/use-public-variant-page', () => ({
  getPublicVariantPage,
}));

import { readCatalogIntent, saveCatalogIntent, type CatalogIntent } from '../lib/catalog-intent';
import { useCatalogIntentPrefill } from './use-catalog-intent-prefill';

const intent: CatalogIntent = {
  segment: 'cars',
  make: 'honda',
  model: 'city',
  generation: 'city-lineup',
  variant: 'vx-cvt',
};

const page = {
  segment: 'cars',
  vehicleType: VehicleType.Car,
  make: { name: 'Honda', slug: 'honda' },
  model: { name: 'City', slug: 'city' },
  generation: { name: 'City lineup', slug: 'city-lineup' },
  variant: { name: 'VX CVT', slug: 'vx-cvt' },
  offerings: [{ fuelTypes: [FuelType.Petrol], yearStart: 2023, yearEnd: null, isCurrent: true }],
  calculatorSeed: { fuelType: FuelType.Petrol },
} as unknown as PublicCatalogVariantPage;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCatalogIntentPrefill', () => {
  beforeEach(() => {
    navigate.mockResolvedValue(undefined);
  });

  it('opens an empty form when there is no intent', () => {
    const { result } = renderHook(() => useCatalogIntentPrefill(undefined), { wrapper });

    expect(result.current).toEqual({ status: 'none' });
    expect(getPublicVariantPage).not.toHaveBeenCalled();
  });

  it('prefills from a stored intent, and uses it up', async () => {
    saveCatalogIntent(intent);
    getPublicVariantPage.mockResolvedValue(page);

    const { result } = renderHook(() => useCatalogIntentPrefill(undefined), { wrapper });

    expect(result.current).toEqual({ status: 'resolving' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({
      values: { make: 'Honda', model: 'City', variant: 'VX CVT', vehicleType: VehicleType.Car },
    });
    expect(getPublicVariantPage).toHaveBeenCalledWith(intent);
    expect(readCatalogIntent()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('prefers the intent in the address, and drops it from there', async () => {
    saveCatalogIntent({ ...intent, variant: 'older-pick' });
    getPublicVariantPage.mockResolvedValue(page);

    const { result } = renderHook(
      () => useCatalogIntentPrefill('/cars/honda/city/city-lineup/vx-cvt'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(getPublicVariantPage).toHaveBeenCalledWith(intent);
    expect(navigate).toHaveBeenCalledWith({ to: '/vehicles/new', search: {}, replace: true });
    expect(readCatalogIntent()).toBeNull();
  });

  it('drops an intent whose variant has left the catalog, without a word', async () => {
    saveCatalogIntent(intent);
    getPublicVariantPage.mockRejectedValue(new ApiError('Not found', 404));

    const { result } = renderHook(() => useCatalogIntentPrefill(undefined), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ status: 'none' }));
    expect(readCatalogIntent()).toBeNull();
  });
});

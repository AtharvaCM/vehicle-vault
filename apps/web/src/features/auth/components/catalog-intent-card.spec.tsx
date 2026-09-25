import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogIntentCard } from './catalog-intent-card';

const variantPage = vi.fn();
const modelPage = vi.fn();

vi.mock('@/features/public-catalog/api/use-public-variant-page', () => ({
  usePublicVariantPage: () => variantPage(),
}));
vi.mock('@/features/public-catalog/api/use-public-model-page', () => ({
  usePublicModelPage: () => modelPage(),
}));

const VARIANT_INTENT = {
  segment: 'cars',
  make: 'honda',
  model: 'amaze',
  generation: '2024',
  variant: 'zx-cvt',
} as const;

describe('CatalogIntentCard', () => {
  beforeEach(() => {
    variantPage.mockReturnValue({ data: undefined });
    modelPage.mockReturnValue({ data: undefined });
  });

  it('names the variant from its slugs until the catalog answers', () => {
    render(<CatalogIntentCard intent={VARIANT_INTENT} />);

    expect(screen.getByTestId('catalog-intent-card')).toHaveTextContent(
      'TrackingHonda Amaze · ZX Cvt',
    );
  });

  it('uses the catalog names once the variant page loads', () => {
    variantPage.mockReturnValue({
      data: { make: { name: 'Honda' }, model: { name: 'Amaze' }, variant: { name: 'ZX CVT' } },
    });
    render(<CatalogIntentCard intent={VARIANT_INTENT} />);

    expect(screen.getByText('Honda Amaze · ZX CVT')).toBeInTheDocument();
  });

  it('names just the model for a model intent', () => {
    modelPage.mockReturnValue({
      data: { make: { name: 'Maruti Suzuki' }, model: { name: 'Swift' } },
    });
    render(
      <CatalogIntentCard intent={{ segment: 'cars', make: 'maruti-suzuki', model: 'swift' }} />,
    );

    expect(screen.getByText('Maruti Suzuki Swift')).toBeInTheDocument();
    expect(variantPage).not.toHaveBeenCalled();
  });
});

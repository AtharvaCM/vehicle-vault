import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CATALOG_INTENT_TTL_MS,
  readCatalogIntent,
  saveCatalogIntent,
  type CatalogIntent,
} from '@/features/catalog-intent/lib/catalog-intent';

vi.mock('@/lib/env/env', () => ({ getEnv: () => ({ apiBaseUrl: '/api' }) }));
vi.mock('../api/get-oauth-providers', () => ({
  oauthProvidersQueryOptions: () => ({
    queryKey: ['auth', 'oauth-providers'],
    queryFn: async () => ['google', 'github'],
  }),
}));

import { OAuthButtons } from './oauth-buttons';

const intent: CatalogIntent = {
  segment: 'cars',
  make: 'honda',
  model: 'city',
  generation: 'city-lineup',
  variant: 'v-cvt',
};

function renderButtons() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OAuthButtons />
    </QueryClientProvider>,
  );
}

async function hrefOf(label: string) {
  const button = await screen.findByRole('button', { name: label });
  return button.closest('a')?.getAttribute('href');
}

describe('OAuthButtons', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts a plain sign-in when no catalog intent is waiting', async () => {
    renderButtons();

    expect(await hrefOf('Continue with Google')).toBe('/api/auth/oauth/google');
    expect(await hrefOf('Continue with GitHub')).toBe('/api/auth/oauth/github');
  });

  it('sends the waiting intent’s model slug with the sign-in, and nothing else', async () => {
    saveCatalogIntent(intent);

    renderButtons();

    expect(await hrefOf('Continue with Google')).toBe('/api/auth/oauth/google?catalogModel=city');
    expect(await hrefOf('Continue with GitHub')).toBe('/api/auth/oauth/github?catalogModel=city');
    // The intent stays here for the callback page and the form.
    expect(readCatalogIntent()).toEqual(intent);
  });

  it('sends nothing for an intent past its expiry', async () => {
    saveCatalogIntent(intent, Date.now() - CATALOG_INTENT_TTL_MS - 1);

    renderButtons();

    expect(await hrefOf('Continue with Google')).toBe('/api/auth/oauth/google');
  });
});

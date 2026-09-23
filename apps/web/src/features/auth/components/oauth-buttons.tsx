import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  catalogIntentAttribution,
  readCatalogIntent,
  type CatalogIntent,
} from '@/features/catalog-intent/lib/catalog-intent';
import { getEnv } from '@/lib/env/env';

import { oauthProvidersQueryOptions, type OAuthProvider } from '../api/get-oauth-providers';

const LABEL: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
};

/**
 * Where a provider's sign-in begins. While a catalog intent is waiting, the
 * model slug goes along: the API carries it through the provider inside the
 * signed OAuth state, so a new account is attributed to the catalog. The
 * intent itself stays in this browser for the callback page to act on. A
 * return path (`next`) travels the same way and comes back in the callback's
 * fragment.
 */
function providerHref(provider: OAuthProvider, intent: CatalogIntent | null, next?: string) {
  const { apiBaseUrl } = getEnv();
  const { catalogModel } = catalogIntentAttribution(intent);
  const params = new URLSearchParams({
    ...(catalogModel ? { catalogModel } : {}),
    ...(next ? { next } : {}),
  }).toString();
  return `${apiBaseUrl}/auth/oauth/${provider}${params ? `?${params}` : ''}`;
}

export function OAuthButtons({ next }: { next?: string }) {
  const query = useQuery(oauthProvidersQueryOptions());
  const providers = query.data ?? [];
  // Read on every render: the register page saves an intent from its address
  // in an effect, then re-renders as it drops the parameter.
  const catalogIntent = readCatalogIntent();

  if (query.isLoading || providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs uppercase tracking-wider text-slate-500">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="space-y-2">
        {providers.map((provider) => (
          <a key={provider} href={providerHref(provider, catalogIntent, next)} className="block">
            <Button type="button" variant="outline" className="w-full">
              {LABEL[provider]}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  catalogIntentAttribution,
  readCatalogIntent,
  type CatalogIntent,
} from '@/features/catalog-intent/lib/catalog-intent';
import { getEnv } from '@/lib/env/env';

import { oauthProvidersQueryOptions, type OAuthProvider } from '../api/get-oauth-providers';

/**
 * The providers offered here. GitHub is hidden from the consumer UI by the
 * owner's decision (#343); its route still works for accounts made with it.
 */
const OFFERED: readonly OAuthProvider[] = ['google'];

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 48 48">
      <path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </svg>
  );
}

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

/**
 * "Continue with Google" above the email form (#343): for most people here it
 * is the quickest way in. Renders nothing, divider included, when no offered
 * provider is configured.
 */
export function OAuthButtons({
  next,
  dividerLabel = 'or use email',
}: {
  next?: string;
  dividerLabel?: string;
}) {
  const query = useQuery(oauthProvidersQueryOptions());
  const providers = (query.data ?? []).filter((provider) => OFFERED.includes(provider));
  // Read on every render: the register page saves an intent from its address
  // in an effect, then re-renders as it drops the parameter.
  const catalogIntent = readCatalogIntent();

  if (query.isLoading || providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {providers.map((provider) => (
          <Button asChild className="w-full" key={provider} variant="outline">
            <a href={providerHref(provider, catalogIntent, next)}>
              <GoogleLogo />
              Continue with Google
            </a>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line-subtle" />
        <span className="text-small font-medium text-fg-3">{dividerLabel}</span>
        <span className="h-px flex-1 bg-line-subtle" />
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { getEnv } from '@/lib/env/env';

import { oauthProvidersQueryOptions, type OAuthProvider } from '../api/get-oauth-providers';

const LABEL: Record<OAuthProvider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
};

function providerHref(provider: OAuthProvider) {
  const { apiBaseUrl } = getEnv();
  return `${apiBaseUrl}/auth/oauth/${provider}`;
}

export function OAuthButtons() {
  const query = useQuery(oauthProvidersQueryOptions());
  const providers = query.data ?? [];

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
          <a
            key={provider}
            href={providerHref(provider)}
            className="block"
          >
            <Button type="button" variant="outline" className="w-full">
              {LABEL[provider]}
            </Button>
          </a>
        ))}
      </div>
    </div>
  );
}

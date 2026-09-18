import { useEffect, useRef } from 'react';

import { useAuth } from './use-auth';

/** Focus and visibility often fire together; one request covers both. */
const MIN_INTERVAL_MS = 10_000;

/**
 * The verification link opens in a new tab, rarely in the one waiting on it.
 * While this tab still shows the banner or the wall, re-read the account each
 * time the tab comes back into view, so returning to it clears them.
 */
export function useRecheckVerificationOnReturn(enabled: boolean) {
  const { refreshUser } = useAuth();
  const lastCheckRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const recheck = () => {
      if (document.visibilityState !== 'visible') return;

      const now = Date.now();
      if (now - lastCheckRef.current < MIN_INTERVAL_MS) return;

      lastCheckRef.current = now;
      void refreshUser();
    };

    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [enabled, refreshUser]);
}

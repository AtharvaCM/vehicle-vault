import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { parseCatalogIntentParam, saveCatalogIntent } from '../lib/catalog-intent';

/**
 * Keeps the intent a `catalog` search parameter carries, for the add-vehicle
 * form to use after the visitor has signed up, then drops the parameter from
 * the address. A parameter that is not a variant or model path is dropped and ignored.
 */
export function useKeepCatalogIntent(catalogParam: string | undefined) {
  const navigate = useNavigate();

  useEffect(() => {
    if (catalogParam === undefined) {
      return;
    }

    const intent = parseCatalogIntentParam(catalogParam);

    if (intent) {
      saveCatalogIntent(intent);
    }

    // Only `catalog` goes: a return path (`next`) stays for after sign-up.
    void navigate({
      to: '/register',
      search: (previous) => ({ next: previous.next }),
      replace: true,
    });
  }, [catalogParam, navigate]);
}

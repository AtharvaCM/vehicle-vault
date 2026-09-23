import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { getPublicVariantPage } from '@/features/public-catalog/api/use-public-variant-page';
import { queryKeys } from '@/lib/query/query-keys';

import {
  catalogIntentVehicleValues,
  type CatalogIntentVehicleValues,
} from '../lib/catalog-intent-vehicle-values';
import {
  clearCatalogIntent,
  parseCatalogIntentParam,
  readCatalogIntent,
  type CatalogIntent,
} from '../lib/catalog-intent';

export type CatalogIntentPrefill =
  /** No intent, or one that no longer resolves: an empty form. */
  | { status: 'none' }
  /** Looking the variant up; the form waits, since it takes its values once. */
  | { status: 'resolving' }
  | { status: 'ready'; values: CatalogIntentVehicleValues };

/**
 * The add-vehicle form's side of a catalog intent. It takes the intent from
 * the `catalog` search parameter (signed in, straight from the page) or else
 * from storage (after registering or verifying), once: storage is cleared and
 * the parameter dropped from the address as soon as the form opens, so the next
 * add-vehicle starts empty whether or not this one is saved.
 *
 * The variant is resolved through its public page endpoint. One that has gone
 * from the catalog, or cannot be reached, leaves the form empty and says
 * nothing: the visitor can still pick it by hand.
 */
export function useCatalogIntentPrefill(catalogParam: string | undefined): CatalogIntentPrefill {
  const navigate = useNavigate();
  // A pure read on the first render. The form's values have to be known before
  // it mounts, and this page never renders outside the browser.
  const [intent] = useState<CatalogIntent | null>(
    () => parseCatalogIntentParam(catalogParam) ?? readCatalogIntent(),
  );

  useEffect(() => {
    clearCatalogIntent();
  }, []);

  useEffect(() => {
    if (catalogParam !== undefined) {
      void navigate({ to: '/vehicles/new', search: {}, replace: true });
    }
  }, [catalogParam, navigate]);

  const query = useQuery({
    queryKey: queryKeys.publicCatalog.variant(
      intent?.segment ?? '',
      intent?.make ?? '',
      intent?.model ?? '',
      intent?.generation ?? '',
      intent?.variant ?? '',
    ),
    queryFn: () => getPublicVariantPage(intent as CatalogIntent),
    enabled: intent !== null,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const values = useMemo(
    () => (query.data ? catalogIntentVehicleValues(query.data) : null),
    [query.data],
  );

  if (!intent || query.isError) {
    return { status: 'none' };
  }

  if (!values) {
    return { status: 'resolving' };
  }

  return { status: 'ready', values };
}

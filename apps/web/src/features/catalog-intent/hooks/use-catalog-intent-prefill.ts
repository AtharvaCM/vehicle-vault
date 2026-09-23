import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { getPublicModelPage } from '@/features/public-catalog/api/use-public-model-page';
import { getPublicVariantPage } from '@/features/public-catalog/api/use-public-variant-page';
import { queryKeys } from '@/lib/query/query-keys';

import {
  catalogIntentVehicleValues,
  catalogModelIntentVehicleValues,
  type CatalogIntentVehicleValues,
} from '../lib/catalog-intent-vehicle-values';
import {
  clearCatalogIntent,
  isCatalogVariantIntent,
  parseCatalogIntentParam,
  readCatalogIntent,
  type CatalogIntent,
  type CatalogModelIntent,
  type CatalogVariantIntent,
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
 * The variant is resolved through its public page endpoint, and a model intent
 * through the model page's, which fills make and model only. One that has gone
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

  const variantIntent = intent && isCatalogVariantIntent(intent) ? intent : null;
  const modelIntent = intent && !isCatalogVariantIntent(intent) ? intent : null;

  const variantQuery = useQuery({
    queryKey: queryKeys.publicCatalog.variant(
      variantIntent?.segment ?? '',
      variantIntent?.make ?? '',
      variantIntent?.model ?? '',
      variantIntent?.generation ?? '',
      variantIntent?.variant ?? '',
    ),
    queryFn: () => getPublicVariantPage(variantIntent as CatalogVariantIntent),
    enabled: variantIntent !== null,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  // A model intent resolves through the model page: make and model, no variant.
  const modelQuery = useQuery({
    queryKey: queryKeys.publicCatalog.model(
      modelIntent?.segment ?? '',
      modelIntent?.make ?? '',
      modelIntent?.model ?? '',
    ),
    queryFn: () => getPublicModelPage(modelIntent as CatalogModelIntent),
    enabled: modelIntent !== null,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const values = useMemo(() => {
    if (variantQuery.data) return catalogIntentVehicleValues(variantQuery.data);
    if (modelQuery.data) return catalogModelIntentVehicleValues(modelQuery.data);
    return null;
  }, [variantQuery.data, modelQuery.data]);

  const query = variantIntent ? variantQuery : modelQuery;

  if (!intent || query.isError) {
    return { status: 'none' };
  }

  if (!values) {
    return { status: 'resolving' };
  }

  return { status: 'ready', values };
}

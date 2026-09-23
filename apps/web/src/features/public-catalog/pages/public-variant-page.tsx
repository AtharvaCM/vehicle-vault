import type { PublicCatalogVariantPage } from '@vehicle-vault/shared';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { ApiError } from '@/lib/api/api-error';

import { usePublicVariantPage, type PublicVariantSlugs } from '../api/use-public-variant-page';
import { PublicCatalogBreadcrumbs } from '../components/public-catalog-breadcrumbs';
import { PublicCatalogShell } from '../components/public-catalog-shell';
import { PublicServiceSchedule } from '../components/public-service-schedule';
import { PublicSpecSections } from '../components/public-spec-sections';
import { RunningCostCalculator } from '../components/running-cost-calculator';
import { variantPageHead } from '../head/public-page-head';
import { usePublicPageHead } from '../head/use-public-page-head';
import { describeOffering } from '../utils/format-public-catalog';
import { TrackThisVehicle } from '../components/track-this-vehicle';

export { variantPageTitle } from '../head/public-page-head';

type PublicVariantRouteProps = {
  slugs: PublicVariantSlugs;
};

/** Fetches the variant page and renders it; an unknown address gets the not-found screen. */
export function PublicVariantRoutePage({ slugs }: PublicVariantRouteProps) {
  const query = usePublicVariantPage(slugs);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundScreen />;
  }

  return (
    <PublicCatalogShell>
      {query.isPending ? (
        <div className="py-6">
          <LoadingState description="Loading the specs and service schedule." title="Loading" />
        </div>
      ) : query.isError ? (
        <div className="py-6">
          <ErrorState
            description="This page could not be loaded. Check your connection and try again."
            title="Something went wrong"
          />
        </div>
      ) : (
        <PublicVariantPageView page={query.data} />
      )}
    </PublicCatalogShell>
  );
}

type PublicVariantPageViewProps = {
  page: PublicCatalogVariantPage;
};

/**
 * Renders from the payload alone, with no fetches of its own, so the same tree
 * can be rendered ahead of time and hydrated over.
 */
export function PublicVariantPageView({ page }: PublicVariantPageViewProps) {
  usePublicPageHead(variantPageHead(page));

  const heading = `${page.make.name} ${page.model.name} ${page.variant.name}`;

  return (
    <article className="space-y-6 pt-4 sm:pt-8" data-testid="public-variant-page">
      <header>
        <PublicCatalogBreadcrumbs page={page} />
        <p className="text-sm font-medium text-slate-600 [overflow-wrap:anywhere]">
          {page.generation.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-4xl">
          {heading}
        </h1>
        {page.offerings.length > 0 ? (
          <ul aria-label="Offered" className="mt-3 flex flex-wrap gap-2">
            {page.offerings.map((offering) => (
              <li
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                key={describeOffering(offering)}
              >
                {describeOffering(offering)}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <PublicServiceSchedule schedule={page.schedule} />

      <RunningCostCalculator page={page} />

      {page.specs ? (
        <section aria-labelledby="specs-heading" className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950" id="specs-heading">
            Specifications
          </h2>
          <PublicSpecSections specs={page.specs} />
        </section>
      ) : null}

      <TrackThisVehicle page={page} />
    </article>
  );
}

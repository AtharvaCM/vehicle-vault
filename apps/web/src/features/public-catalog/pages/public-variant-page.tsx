import type { PublicCatalogVariantPage } from '@vehicle-vault/shared';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { ApiError } from '@/lib/api/api-error';

import { usePublicVariantPage, type PublicVariantSlugs } from '../api/use-public-variant-page';
import { PublicCatalogBreadcrumbs } from '../components/public-catalog-breadcrumbs';
import { PublicCatalogLink } from '../components/public-catalog-link';
import { PublicCatalogShell } from '../components/public-catalog-shell';
import { PublicServiceSchedule } from '../components/public-service-schedule';
import { PublicSpecSections } from '../components/public-spec-sections';
import { RunningCostCalculator } from '../components/running-cost-calculator';
import { variantPageHead } from '../head/public-page-head';
import { usePublicPageHead } from '../head/use-public-page-head';
import { describeOffering } from '../utils/format-public-catalog';
import { TrackThisVehicle, TrackThisVehicleBar } from '../components/track-this-vehicle';
import { VariantKeyFacts } from '../components/variant-key-facts';

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
  // "Amaze lineup" is a name the import makes up when a model has no named
  // generation; a real one ("4th Gen") helps tell the variant apart.
  const generationName =
    page.generation.name.toLowerCase() === `${page.model.name} lineup`.toLowerCase()
      ? null
      : page.generation.name;
  const meta = [generationName, ...page.offerings.map(describeOffering)]
    .filter(Boolean)
    .join(' · ');

  return (
    // Room at the bottom on a phone for the Track bar.
    <article className="space-y-6 pb-20 pt-4 sm:pt-8 md:pb-0" data-testid="public-variant-page">
      <header>
        <PublicCatalogBreadcrumbs page={page} />
        <h1 className="font-display text-title font-semibold tracking-tight text-fg wrap-anywhere sm:text-display">
          {heading}
        </h1>
        {meta ? <p className="mt-2 text-ui text-fg-2">{meta}</p> : null}
        {page.siblings.length > 0 ? (
          <nav aria-label="Other variants" className="mt-2 text-ui text-fg-2">
            Other {page.model.name} variants:{' '}
            {page.siblings.map((sibling, index) => (
              <span key={sibling.slug}>
                {index > 0 ? ' · ' : null}
                <PublicCatalogLink
                  address={{
                    segment: page.segment,
                    make: page.make.slug,
                    model: page.model.slug,
                    generation: page.generation.slug,
                    variant: sibling.slug,
                  }}
                  className="font-medium text-fg underline underline-offset-4 hover:text-fg-2"
                >
                  {sibling.name}
                </PublicCatalogLink>
              </span>
            ))}
          </nav>
        ) : null}
      </header>

      <VariantKeyFacts page={page} />

      <RunningCostCalculator page={page} />

      <section aria-labelledby="specs-heading" className="space-y-3">
        <h2 className="text-lead font-semibold tracking-tight text-fg" id="specs-heading">
          Specifications
        </h2>
        {page.specs ? (
          <PublicSpecSections specs={page.specs} />
        ) : (
          <p className="rounded-card border border-line bg-surface px-4 py-3 text-ui text-fg-2">
            We don’t have this variant’s specifications yet.
          </p>
        )}
      </section>

      <PublicServiceSchedule schedule={page.schedule} />

      <TrackThisVehicle page={page} />
      <TrackThisVehicleBar page={page} />
    </article>
  );
}

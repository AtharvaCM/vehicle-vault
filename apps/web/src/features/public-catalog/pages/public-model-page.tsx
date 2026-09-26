import type { PublicCatalogModelPage } from '@vehicle-vault/shared';
import { ChevronRight } from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { ApiError } from '@/lib/api/api-error';

import { usePublicModelPage, type PublicModelSlugs } from '../api/use-public-model-page';
import { PublicCatalogBreadcrumbs } from '../components/public-catalog-breadcrumbs';
import { PublicCatalogLink } from '../components/public-catalog-link';
import { PublicCatalogShell } from '../components/public-catalog-shell';
import { PublicServiceSchedule } from '../components/public-service-schedule';
import { PublicSpecSections } from '../components/public-spec-sections';
import { CatalogFreshness } from '../components/catalog-freshness';
import { TrackThisVehicle } from '../components/track-this-vehicle';
import { modelPageHead } from '../head/public-page-head';
import { usePublicPageHead } from '../head/use-public-page-head';
import {
  describeModelScheduleBasis,
  describeModelVariant,
  formatFuelTypes,
  formatYearSpan,
  modelFuelTypes,
  modelVariants,
  modelYearSpan,
  realGenerationName,
} from '../utils/format-public-catalog';

export { modelPageTitle } from '../head/public-page-head';

type PublicModelRouteProps = {
  slugs: PublicModelSlugs;
};

/** Fetches the model page and renders it; an unknown address gets the not-found screen. */
export function PublicModelRoutePage({ slugs }: PublicModelRouteProps) {
  const query = usePublicModelPage(slugs);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundScreen />;
  }

  return (
    <PublicCatalogShell>
      {query.isPending ? (
        <div className="py-6">
          <LoadingState description="Loading the variants and service schedule." title="Loading" />
        </div>
      ) : query.isError ? (
        <div className="py-6">
          <ErrorState
            description="This page could not be loaded. Check your connection and try again."
            title="Something went wrong"
          />
        </div>
      ) : (
        <PublicModelPageView page={query.data} />
      )}
    </PublicCatalogShell>
  );
}

type PublicModelPageViewProps = {
  page: PublicCatalogModelPage;
};

/**
 * A model's variants by generation, current first, each a link to its own
 * page; then one variant's schedule and specs, named as that variant's. Renders
 * from the payload alone, with no fetches of its own, so the same tree can be
 * rendered ahead of time and hydrated over.
 */
export function PublicModelPageView({ page }: PublicModelPageViewProps) {
  usePublicPageHead(modelPageHead(page));

  const modelName = `${page.make.name} ${page.model.name}`;
  const variantCount = modelVariants(page).length;
  const representativeName = `${modelName} ${page.representative.variant.name}`;
  const summary = [
    `${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}`,
    formatFuelTypes(modelFuelTypes(page)),
    modelYearSpan(page),
  ].filter(Boolean);

  return (
    <article className="space-y-6 pt-4 sm:pt-8" data-testid="public-model-page">
      <header>
        <PublicCatalogBreadcrumbs page={page} />
        <h1 className="text-title font-semibold tracking-tight text-fg wrap-anywhere sm:text-display">
          {modelName}
        </h1>
        <p className="mt-2 text-ui text-fg-2">{summary.join(' · ')}</p>
        <a
          className="mt-2 inline-flex items-center gap-1 text-ui font-semibold text-brand hover:underline"
          href="#track-this-vehicle"
        >
          Own one? Track it free
          <ChevronRight aria-hidden="true" className="size-4" />
        </a>
      </header>

      <section aria-labelledby="variants-heading" className="space-y-3">
        <div>
          <h2 className="text-lead font-semibold tracking-tight text-fg" id="variants-heading">
            Variants
          </h2>
          <p className="mt-1 text-ui leading-6 text-fg-2">
            Pick yours for its own service schedule, running-cost estimate and specs.
          </p>
        </div>

        {page.generations.map((generation) => {
          const headingId = `generation-${generation.slug}`;
          // With no years, "On sale now" would only repeat the Current badge.
          const years =
            generation.yearStart || generation.yearEnd ? formatYearSpan(generation) : null;
          // A made-up name ("Amaze lineup") says nothing: the years, or plain
          // "Variants", head the list instead.
          const name = realGenerationName(generation.name, page.model.name);
          const heading = name ?? years ?? (generation.isCurrent ? 'On sale now' : 'Variants');

          return (
            <section
              aria-labelledby={headingId}
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
              key={generation.slug}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line-subtle px-4 py-3 sm:px-5">
                <h3 className="text-lead font-semibold text-fg wrap-anywhere" id={headingId}>
                  {heading}
                </h3>
                <p className="flex items-center gap-2 text-ui text-fg-2">
                  {name ? years : null}
                  {generation.isCurrent ? (
                    <span className="rounded-full bg-ok-tint px-2 py-0.5 text-caption font-medium text-ok">
                      Current
                    </span>
                  ) : null}
                </p>
              </div>
              <ul className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                {generation.variants.map((variant) => (
                  <li key={variant.slug}>
                    <PublicCatalogLink
                      address={{
                        segment: page.segment,
                        make: page.make.slug,
                        model: page.model.slug,
                        generation: generation.slug,
                        variant: variant.slug,
                      }}
                      className="group flex h-full items-center justify-between gap-3 rounded-control border border-line-subtle bg-page/60 px-4 py-3 hover:border-fg-3 hover:bg-surface focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="min-w-0">
                        <span className="block text-ui font-semibold text-fg wrap-anywhere">
                          {modelName} {variant.name}
                        </span>{' '}
                        <span className="mt-0.5 block text-small text-fg-2">
                          {describeModelVariant(variant)}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-fg-3 group-hover:text-fg"
                      />
                    </PublicCatalogLink>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>

      <PublicServiceSchedule
        heading={describeModelScheduleBasis(page)}
        note={`Shown for the ${representativeName}. Each variant’s page has its own.`}
        schedule={page.schedule}
      />

      {page.representative.specs ? (
        <section aria-labelledby="specs-heading" className="space-y-3">
          <div>
            <h2 className="text-lead font-semibold tracking-tight text-fg" id="specs-heading">
              Specifications of the {representativeName}
            </h2>
            <p className="mt-1 text-ui leading-6 text-fg-2">
              One variant’s figures, as an example. Other variants differ; each has its own page.
            </p>
          </div>
          <PublicSpecSections specs={page.representative.specs} />
        </section>
      ) : null}

      <TrackThisVehicle page={page} />

      <CatalogFreshness updatedAt={page.updatedAt} />
    </article>
  );
}

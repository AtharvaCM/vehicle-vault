import type {
  PublicCatalogBrowseModel,
  PublicCatalogBrowsePage,
  PublicCatalogSegment,
} from '@vehicle-vault/shared';
import { ChevronRight } from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';

import { usePublicBrowsePage } from '../api/use-public-browse-page';
import { CatalogSearch } from '../components/catalog-search';
import { PublicCatalogLink } from '../components/public-catalog-link';
import { PublicCatalogShell } from '../components/public-catalog-shell';
import { TrackYourVehicleOffer } from '../components/track-your-vehicle-offer';
import { browsePageHead } from '../head/public-page-head';
import { usePublicPageHead } from '../head/use-public-page-head';

export { browsePageTitle } from '../head/public-page-head';

type PublicBrowseRouteProps = {
  segment: PublicCatalogSegment;
};

/** Fetches the segment's makes and renders them. */
export function PublicBrowseRoutePage({ segment }: PublicBrowseRouteProps) {
  const query = usePublicBrowsePage(segment);

  return (
    <PublicCatalogShell>
      {query.isPending ? (
        <div className="py-6">
          <LoadingState description="Loading the makes." title="Loading" />
        </div>
      ) : query.isError ? (
        <div className="py-6">
          <ErrorState
            description="This page could not be loaded. Check your connection and try again."
            title="Something went wrong"
          />
        </div>
      ) : (
        <PublicBrowsePageView page={query.data} />
      )}
    </PublicCatalogShell>
  );
}

const COPY: Record<
  PublicCatalogSegment,
  { heading: string; other: PublicCatalogSegment; otherLabel: string }
> = {
  cars: { heading: 'Cars in India', other: 'bikes', otherLabel: 'Browse bikes' },
  bikes: { heading: 'Bikes in India', other: 'cars', otherLabel: 'Browse cars' },
};

/**
 * Models most people look for, by make and model slug, shown when the catalog
 * has them. Our pick, not a sales ranking: the catalog holds no sales data.
 */
const POPULAR_MODELS: Record<PublicCatalogSegment, ReadonlyArray<readonly [string, string]>> = {
  cars: [
    ['maruti-suzuki', 'swift'],
    ['hyundai', 'creta'],
    ['tata', 'nexon'],
    ['honda', 'city'],
    ['maruti-suzuki', 'brezza'],
    ['mahindra', 'xuv700'],
    ['tata', 'punch'],
    ['toyota', 'innova-crysta'],
  ],
  bikes: [
    ['hero', 'splendor-plus'],
    ['honda', 'activa-6g'],
    ['royal-enfield', 'classic-350'],
    ['tvs', 'jupiter'],
    ['bajaj', 'pulsar-150'],
    ['tvs', 'apache-rtr-160'],
  ],
};

const chipClass =
  'inline-flex h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-ui font-medium text-fg hover:border-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:h-9';

type PublicBrowsePageViewProps = {
  page: PublicCatalogBrowsePage;
};

/**
 * The catalog's front door for a segment (#345): how much it holds, a search
 * over its makes and models, a tile per make, popular models, and the offer
 * to track your own. Renders from the payload alone, so the same tree can be
 * rendered ahead of time and hydrated over.
 */
export function PublicBrowsePageView({ page }: PublicBrowsePageViewProps) {
  usePublicPageHead(browsePageHead(page));

  const copy = COPY[page.segment];
  const modelCount = page.models.length;
  const makeCount = page.makes.length;
  const popular = POPULAR_MODELS[page.segment]
    .map(([make, model]) =>
      page.models.find((candidate) => candidate.make.slug === make && candidate.slug === model),
    )
    .filter((model): model is PublicCatalogBrowseModel => Boolean(model));

  return (
    <article className="space-y-8 pt-4 sm:pt-8" data-testid="public-browse-page">
      <header className="space-y-4">
        <div>
          <h1 className="font-display text-title font-semibold tracking-tight text-fg sm:text-display">
            {copy.heading}
          </h1>
          {makeCount > 0 ? (
            <p className="mt-2 text-ui text-fg-2">
              {`Service intervals and running costs for ${modelCount} ${modelCount === 1 ? 'model' : 'models'} from ${makeCount} ${makeCount === 1 ? 'maker' : 'makers'}.`}
            </p>
          ) : null}
          <PublicCatalogLink
            address={{ segment: copy.other }}
            className="-ml-1 mt-1 inline-flex rounded-lg px-1 py-1 text-ui font-medium text-fg-2 underline underline-offset-4 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
          >
            {copy.otherLabel}
          </PublicCatalogLink>
        </div>
        {makeCount > 0 ? <CatalogSearch page={page} /> : null}
      </header>

      {makeCount === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-ui text-fg-2 shadow-xs">
          Nothing here yet.
        </p>
      ) : (
        <>
          <section aria-labelledby="makes-heading" className="space-y-3">
            <h2 className="text-lead font-semibold tracking-tight text-fg" id="makes-heading">
              Makes
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {page.makes.map((make) => (
                <li key={make.slug}>
                  <PublicCatalogLink
                    address={{ segment: page.segment, make: make.slug }}
                    className="flex h-full min-h-20 flex-col justify-between gap-2 rounded-card border border-line bg-surface p-4 shadow-xs hover:border-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="block font-semibold text-fg wrap-anywhere">{make.name}</span>
                    <span className="block text-small text-fg-2">
                      {`${make.modelCount} ${make.modelCount === 1 ? 'model' : 'models'}`}
                    </span>
                  </PublicCatalogLink>
                </li>
              ))}
            </ul>
          </section>

          {popular.length > 0 ? (
            <section aria-labelledby="popular-heading" className="space-y-3">
              <h2 className="text-lead font-semibold tracking-tight text-fg" id="popular-heading">
                Popular models
              </h2>
              <ul className="flex flex-wrap gap-2">
                {popular.map((model) => (
                  <li key={`${model.make.slug}/${model.slug}`}>
                    <PublicCatalogLink
                      address={{ segment: page.segment, make: model.make.slug, model: model.slug }}
                      className={chipClass}
                    >
                      {`${model.make.name} ${model.name}`}
                      <ChevronRight aria-hidden="true" className="size-4 text-fg-3" />
                    </PublicCatalogLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TrackYourVehicleOffer action="Track your vehicle" heading="Own one already?" />
        </>
      )}
    </article>
  );
}

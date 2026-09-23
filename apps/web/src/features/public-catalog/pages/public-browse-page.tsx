import type { PublicCatalogBrowsePage, PublicCatalogSegment } from '@vehicle-vault/shared';
import { ChevronRight } from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';

import { usePublicBrowsePage } from '../api/use-public-browse-page';
import { PublicCatalogLink } from '../components/public-catalog-link';
import { PublicCatalogShell } from '../components/public-catalog-shell';
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
  { heading: string; noun: string; other: PublicCatalogSegment; otherLabel: string }
> = {
  cars: { heading: 'Cars by make', noun: 'car', other: 'bikes', otherLabel: 'Browse bikes' },
  bikes: { heading: 'Bikes by make', noun: 'motorcycle', other: 'cars', otherLabel: 'Browse cars' },
};

type PublicBrowsePageViewProps = {
  page: PublicCatalogBrowsePage;
};

/**
 * Every make with public pages in the segment, by name, each a link to its
 * make page: the way in for a visitor who knows only the brand. Renders from
 * the payload alone, so the same tree can be rendered ahead of time and
 * hydrated over.
 */
export function PublicBrowsePageView({ page }: PublicBrowsePageViewProps) {
  usePublicPageHead(browsePageHead(page));

  const copy = COPY[page.segment];

  return (
    <article className="space-y-6 pt-4 sm:pt-8" data-testid="public-browse-page">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          {copy.heading}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {`The service schedule, a running-cost estimate and the specs for every ${copy.noun} variant in our catalog. Start with the make.`}
        </p>
        <PublicCatalogLink
          address={{ segment: copy.other }}
          className="-ml-1 mt-2 inline-flex rounded-lg px-1 py-1 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {copy.otherLabel}
        </PublicCatalogLink>
      </header>

      {page.makes.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Nothing here yet.
        </p>
      ) : (
        <section aria-labelledby="makes-heading" className="space-y-3">
          <h2 className="sr-only" id="makes-heading">
            Makes
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {page.makes.map((make) => (
              <li key={make.slug}>
                <PublicCatalogLink
                  address={{ segment: page.segment, make: make.slug }}
                  className="flex h-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
                      {make.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-600">
                      {`${make.modelCount} ${make.modelCount === 1 ? 'model' : 'models'}`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                </PublicCatalogLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

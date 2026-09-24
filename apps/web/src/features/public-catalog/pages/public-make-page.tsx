import type { PublicCatalogMakeModel, PublicCatalogMakePage } from '@vehicle-vault/shared';
import { ChevronRight } from 'lucide-react';

import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { NotFoundScreen } from '@/components/errors/not-found-screen';
import { ApiError } from '@/lib/api/api-error';

import { usePublicMakePage, type PublicMakeSlugs } from '../api/use-public-make-page';
import { PublicCatalogBreadcrumbs } from '../components/public-catalog-breadcrumbs';
import { PublicCatalogLink } from '../components/public-catalog-link';
import { PublicCatalogShell } from '../components/public-catalog-shell';
import { makePageHead } from '../head/public-page-head';
import { usePublicPageHead } from '../head/use-public-page-head';
import { describeMakeModel } from '../utils/format-public-catalog';

export { makePageTitle } from '../head/public-page-head';

type PublicMakeRouteProps = {
  slugs: PublicMakeSlugs;
};

/** Fetches the make page and renders it; an unknown make gets the not-found screen. */
export function PublicMakeRoutePage({ slugs }: PublicMakeRouteProps) {
  const query = usePublicMakePage(slugs);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundScreen />;
  }

  return (
    <PublicCatalogShell>
      {query.isPending ? (
        <div className="py-6">
          <LoadingState description="Loading the models." title="Loading" />
        </div>
      ) : query.isError ? (
        <div className="py-6">
          <ErrorState
            description="This page could not be loaded. Check your connection and try again."
            title="Something went wrong"
          />
        </div>
      ) : (
        <PublicMakePageView page={query.data} />
      )}
    </PublicCatalogShell>
  );
}

type PublicMakePageViewProps = {
  page: PublicCatalogMakePage;
};

const SEGMENT_NOUNS = { cars: 'cars', bikes: 'bikes' } as const;

/**
 * A make's models, those on sale first, each a link to its model page.
 * Renders from the payload alone, so the same tree can be rendered ahead of
 * time and hydrated over.
 */
export function PublicMakePageView({ page }: PublicMakePageViewProps) {
  usePublicPageHead(makePageHead(page));

  const onSale = page.models.filter((model) => model.isCurrent);
  const earlier = page.models.filter((model) => !model.isCurrent);
  const count = page.models.length;

  return (
    <article className="space-y-6 pt-4 sm:pt-8" data-testid="public-make-page">
      <header>
        <PublicCatalogBreadcrumbs page={page} />
        <h1 className="text-3xl font-semibold tracking-tight text-fg wrap-anywhere sm:text-4xl">
          {`${page.make.name} ${SEGMENT_NOUNS[page.segment]}`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-fg-2">
          {`${count} ${count === 1 ? 'model' : 'models'}. Pick yours for its variants, service schedule and specs.`}
        </p>
      </header>

      {onSale.length > 0 ? (
        <ModelList heading="On sale" id="on-sale-heading" models={onSale} page={page} />
      ) : null}
      {earlier.length > 0 ? (
        <ModelList
          heading={onSale.length > 0 ? 'No longer sold' : 'Models'}
          id="earlier-heading"
          models={earlier}
          page={page}
        />
      ) : null}
    </article>
  );
}

function ModelList({
  heading,
  id,
  models,
  page,
}: {
  heading: string;
  id: string;
  models: PublicCatalogMakeModel[];
  page: PublicCatalogMakePage;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-fg" id={id}>
        {heading}
      </h2>
      <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
        {models.map((model) => (
          <li key={model.slug}>
            <PublicCatalogLink
              address={{ segment: page.segment, make: page.make.slug, model: model.slug }}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-page focus-visible:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-5"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg wrap-anywhere">
                  {`${page.make.name} ${model.name}`}
                </span>
                <span className="mt-0.5 block text-sm text-fg-2">{describeMakeModel(model)}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-3" />
            </PublicCatalogLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { ChevronRight } from 'lucide-react';

import { publicCatalogBreadcrumbs, type BreadcrumbSource } from '../utils/breadcrumbs';
import { PublicCatalogLink } from './public-catalog-link';

type PublicCatalogBreadcrumbsProps = {
  page: BreadcrumbSource;
};

/**
 * The way back up the catalog: browse → make → model, ending on the page
 * itself, which is not a link. Wraps rather than scrolls on a narrow screen.
 */
export function PublicCatalogBreadcrumbs({ page }: PublicCatalogBreadcrumbsProps) {
  const crumbs = publicCatalogBreadcrumbs(page);

  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="-ml-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <li className="flex min-w-0 items-center gap-1" key={crumb.name + index}>
              {index > 0 ? (
                <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-fg-3" />
              ) : null}
              {isCurrent ? (
                <span aria-current="page" className="px-1 py-1 font-medium text-fg wrap-anywhere">
                  {crumb.name}
                </span>
              ) : (
                <PublicCatalogLink
                  address={crumb.address}
                  className="rounded-lg px-1 py-1 font-medium text-fg-2 underline-offset-4 wrap-anywhere hover:text-fg hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {crumb.name}
                </PublicCatalogLink>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

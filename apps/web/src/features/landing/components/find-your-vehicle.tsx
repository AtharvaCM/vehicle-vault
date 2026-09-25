import type { PublicCatalogBrowseMake, PublicCatalogSegment } from '@vehicle-vault/shared';
import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { usePublicBrowsePage } from '@/features/public-catalog/api/use-public-browse-page';
import { PublicCatalogLink } from '@/features/public-catalog/components/public-catalog-link';

/** Makes most people look for first, shown as chips when the catalog has them. */
const POPULAR: Record<PublicCatalogSegment, readonly string[]> = {
  cars: ['maruti-suzuki', 'hyundai', 'tata', 'mahindra'],
  bikes: ['hero', 'honda', 'tvs', 'royal-enfield', 'bajaj'],
};

const SEGMENT_NOUN: Record<PublicCatalogSegment, string> = { cars: 'Cars', bikes: 'Bikes' };

/** At most this many matches, so the list never outgrows a phone screen. */
const MAX_MATCHES = 8;

type SegmentMake = PublicCatalogBrowseMake & { segment: PublicCatalogSegment };

function useCatalogMakes(): SegmentMake[] {
  const cars = usePublicBrowsePage('cars').data;
  const bikes = usePublicBrowsePage('bikes').data;
  return useMemo(
    () => [
      ...(cars?.makes ?? []).map((make) => ({ ...make, segment: 'cars' as const })),
      ...(bikes?.makes ?? []).map((make) => ({ ...make, segment: 'bikes' as const })),
    ],
    [bikes, cars],
  );
}

const chipClass =
  'inline-flex h-11 items-center rounded-full border border-line bg-surface px-4 text-ui font-medium text-fg hover:border-fg-3 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:h-9';

/**
 * The landing page's way into the catalog (#342): search the makes of cars and
 * bikes, or pick a popular one. No account needed; a make page leads on to its
 * models, and a variant page's Track this vehicle carries the pick into sign-up.
 */
export function FindYourVehicle() {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const makes = useCatalogMakes();
  const term = query.trim().toLowerCase();

  const matches = term
    ? makes
        .filter((make) => make.name.toLowerCase().includes(term) || make.slug.includes(term))
        .slice(0, MAX_MATCHES)
    : [];
  const popular = (['cars', 'bikes'] as const).flatMap((segment) =>
    POPULAR[segment]
      .map((slug) => makes.find((make) => make.segment === segment && make.slug === slug))
      .filter((make): make is SegmentMake => Boolean(make)),
  );

  return (
    <section
      aria-labelledby="find-heading"
      className="scroll-mt-20 rounded-card border border-line bg-surface p-5 sm:p-8"
      id="find-your-vehicle"
    >
      <h2
        className="font-display text-title font-semibold tracking-tight text-fg"
        id="find-heading"
      >
        Find your vehicle
      </h2>
      <p className="mt-1 text-ui text-fg-2">
        Its service schedule, a running-cost estimate and its specs. No account needed.
      </p>

      <div className="mt-5 max-w-xl">
        <label className="sr-only" htmlFor={inputId}>
          Search a make
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-3"
          />
          <Input
            autoComplete="off"
            className="pl-9"
            id={inputId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a make: Honda, Tata, Royal Enfield…"
            type="search"
            value={query}
          />
        </div>
        {term ? (
          <div aria-live="polite" className="mt-2">
            {matches.length > 0 ? (
              <ul
                aria-label="Makes that match"
                className="divide-y divide-line-subtle rounded-control border border-line"
              >
                {matches.map((make) => (
                  <li key={`${make.segment}/${make.slug}`}>
                    <PublicCatalogLink
                      address={{ segment: make.segment, make: make.slug }}
                      className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-ui hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="font-medium text-fg">{make.name}</span>{' '}
                      <span className="text-small text-fg-3">
                        {SEGMENT_NOUN[make.segment]} · {make.modelCount}{' '}
                        {make.modelCount === 1 ? 'model' : 'models'}
                      </span>
                    </PublicCatalogLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-fg-2">
                No make matches “{query.trim()}” yet. Browse all the{' '}
                <PublicCatalogLink address={{ segment: 'cars' }} className="font-semibold text-fg">
                  cars
                </PublicCatalogLink>{' '}
                or{' '}
                <PublicCatalogLink address={{ segment: 'bikes' }} className="font-semibold text-fg">
                  bikes
                </PublicCatalogLink>
                .
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {popular.length > 0 ? <p className="mr-1 text-small text-fg-3">Popular</p> : null}
        {popular.map((make) => (
          <PublicCatalogLink
            address={{ segment: make.segment, make: make.slug }}
            className={chipClass}
            key={`${make.segment}/${make.slug}`}
          >
            {make.name}
            {/* Honda makes both: say which. */}
            {makes.some((other) => other.slug === make.slug && other.segment !== make.segment)
              ? ` ${SEGMENT_NOUN[make.segment].toLowerCase()}`
              : null}
          </PublicCatalogLink>
        ))}
        <PublicCatalogLink address={{ segment: 'cars' }} className={chipClass}>
          All cars
        </PublicCatalogLink>
        <PublicCatalogLink address={{ segment: 'bikes' }} className={chipClass}>
          All bikes
        </PublicCatalogLink>
      </div>
    </section>
  );
}

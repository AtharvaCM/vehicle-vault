import type { PublicCatalogBrowsePage } from '@vehicle-vault/shared';
import { Search } from 'lucide-react';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';

import { PublicCatalogLink } from './public-catalog-link';

/** At most this many matches, so the list never outgrows a phone screen. */
const MAX_MATCHES = 8;

const EXAMPLES: Record<PublicCatalogBrowsePage['segment'], string> = {
  cars: 'Search: Amaze, Creta, Nexon…',
  bikes: 'Search: Classic 350, Activa, Apache…',
};

type Match =
  | { kind: 'make'; name: string; slug: string; detail: string }
  | { kind: 'model'; name: string; slug: string; make: string; detail: string };

/** Case-, space- and hyphen-insensitive, so "classic350" finds "Classic 350". */
function normalise(value: string) {
  return value.toLowerCase().replace(/[\s-]+/g, '');
}

/** Every word of the query somewhere in the name: "maruti swift" finds "Maruti Suzuki Swift". */
function matchesAll(name: string, words: string[]) {
  const haystack = normalise(name);
  return words.every((word) => haystack.includes(word));
}

function findMatches(page: PublicCatalogBrowsePage, query: string): Match[] {
  const words = query.split(/\s+/).map(normalise).filter(Boolean);
  if (words.length === 0) return [];
  const makes: Match[] = page.makes
    .filter((make) => matchesAll(make.name, words))
    .map((make) => ({
      kind: 'make',
      name: make.name,
      slug: make.slug,
      detail: `${make.modelCount} ${make.modelCount === 1 ? 'model' : 'models'}`,
    }));
  const models: Match[] = page.models
    .filter((model) => matchesAll(`${model.make.name} ${model.name}`, words))
    // On sale first, so "City" finds the one in showrooms before an old one.
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
    .map((model) => ({
      kind: 'model',
      name: `${model.make.name} ${model.name}`,
      slug: model.slug,
      make: model.make.slug,
      detail: model.isCurrent ? 'On sale' : 'No longer sold',
    }));
  return [...makes, ...models].slice(0, MAX_MATCHES);
}

/**
 * The browse page's search (#345): makes and models of the segment, from the
 * page's own payload, so it needs no request and works on a prerendered page
 * once it has hydrated.
 */
export function CatalogSearch({ page }: { page: PublicCatalogBrowsePage }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const matches = findMatches(page, query);

  return (
    <div className="max-w-xl">
      <label className="sr-only" htmlFor={inputId}>
        Search makes and models
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
          placeholder={EXAMPLES[page.segment]}
          type="search"
          value={query}
        />
      </div>
      {query.trim() ? (
        <div aria-live="polite" className="mt-2">
          {matches.length > 0 ? (
            <ul
              aria-label="Matches"
              className="divide-y divide-line-subtle overflow-hidden rounded-control border border-line bg-surface"
            >
              {matches.map((match) => (
                <li key={`${match.kind}/${match.kind === 'model' ? match.make : ''}/${match.slug}`}>
                  <PublicCatalogLink
                    address={
                      match.kind === 'make'
                        ? { segment: page.segment, make: match.slug }
                        : { segment: page.segment, make: match.make, model: match.slug }
                    }
                    className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-ui hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="font-medium text-fg">{match.name}</span>{' '}
                    <span className="shrink-0 text-small text-fg-3">{match.detail}</span>
                  </PublicCatalogLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui text-fg-2">
              Nothing matches “{query.trim()}” yet. Try the make’s name, or pick it below.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

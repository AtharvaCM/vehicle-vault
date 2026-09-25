import { useQuery } from '@tanstack/react-query';

import { workshopNamesQueryOptions } from '../api/get-workshop-names';

/** How many past workshops are offered at once. */
const SHOWN = 4;

/**
 * The past workshops worth offering for what is typed so far, most recent
 * first: those with a word starting with it ("tor" finds Torque Garage, not
 * Sai Motors), and not the one already typed out in full.
 */
export function matchWorkshops(names: readonly string[], typed: string): string[] {
  const query = typed.trim().toLowerCase();

  return names
    .filter((name) => {
      const candidate = name.toLowerCase();
      return (
        candidate !== query &&
        (!query ||
          candidate.startsWith(query) ||
          candidate.split(/\s+/).some((word) => word.startsWith(query)))
      );
    })
    .slice(0, SHOWN);
}

type WorkshopSuggestionsProps = {
  typed: string;
  onPick: (name: string) => void;
};

/**
 * The workshops this owner used before, one tap to fill the field in, so the
 * same garage is not typed out again (or spelled three ways across a history).
 */
export function WorkshopSuggestions({ typed, onPick }: WorkshopSuggestionsProps) {
  const workshopsQuery = useQuery(workshopNamesQueryOptions());
  const matches = matchWorkshops(workshopsQuery.data ?? [], typed);

  if (!matches.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-small text-fg-3" id="maintenance-workshop-used-before">
        Used before
      </span>
      <ul aria-labelledby="maintenance-workshop-used-before" className="contents">
        {matches.map((name) => (
          <li className="contents" key={name}>
            <button
              className="inline-flex h-11 max-w-full items-center truncate rounded-full border border-line bg-surface px-3 text-small font-medium text-fg transition-colors hover:bg-page focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-8"
              onClick={() => onPick(name)}
              type="button"
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

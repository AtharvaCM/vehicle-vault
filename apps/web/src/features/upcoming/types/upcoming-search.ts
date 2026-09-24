import { UPCOMING_KIND_FILTERS, type UpcomingKindFilter } from '@vehicle-vault/shared';

/** What `/upcoming` keeps in its URL: which vehicle, and which kind of row. */
export type UpcomingSearch = {
  vehicle?: string;
  kind?: UpcomingKindFilter;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUpcomingKindFilter(value: unknown): value is UpcomingKindFilter {
  return typeof value === 'string' && (UPCOMING_KIND_FILTERS as readonly string[]).includes(value);
}

/**
 * Never throws: anything that is not a vehicle id or a known kind is dropped,
 * including the old reminders list's `search`, `status`, `type` and `sort`,
 * which a bookmark from before the timeline may still carry.
 */
export function normalizeUpcomingSearch(search: Record<string, unknown>): UpcomingSearch {
  const vehicle =
    typeof search.vehicle === 'string' && UUID_PATTERN.test(search.vehicle)
      ? search.vehicle
      : undefined;
  const kind = isUpcomingKindFilter(search.kind) ? search.kind : undefined;

  return {
    ...(vehicle ? { vehicle } : {}),
    ...(kind ? { kind } : {}),
  };
}
